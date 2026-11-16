# Répartition comptable des paiements

Les paiements restent exclusivement dans Stripe Test. Aucun compte Connect,
transfert, retrait ou virement bancaire n'est créé par ce module.

- Le paramètre global `PAYMENT_COMMISSION.commissionBps` contient le taux en
  centièmes de pourcentage : 1000 = 10 %. Sa valeur par défaut est 1000.
- Les deux parcours existants, Checkout et Payment Element, créent une
  `PaymentAllocation` dans la même transaction PostgreSQL que la confirmation
  de facture. Le verrou de facture et la clé unique `paymentId` empêchent les
  doubles crédits entre événements et entre workers.
- Les montants sont des millimes TND entiers. Les proportions utilisent des
  calculs BigInt, avec arrondi au millime le plus proche. La part du
  professionnel est toujours le complément exact de la commission.
- Les soldes comptables sont les sommes des parts enregistrées, moins les
  parts remboursées. Il n'existe pas de compteur de portefeuille indépendant
  susceptible de diverger du journal.
- Le taux et les montants initiaux restent figés après confirmation. Les
  paiements déjà confirmés lors de la migration sont conservés à 0 % de
  commission : aucune commission rétroactive.

## Remboursements

Les remboursements Admin intégraux existants restent disponibles. Les
remboursements intégraux et partiels effectués dans Stripe sont également
comptabilisés par `refund.created`, `refund.updated`, `refund.failed` et
`charge.refunded`. Le script Stripe local écoute ces événements.

Chaque remboursement distant possède une clé unique. Son état actuel est
vérifié auprès de Stripe, puis les montants cumulés sont recalculés sous le
verrou de facture. Un remboursement en attente ne débite pas les soldes.
Les montants dans la devise Stripe sont ramenés aux millimes TND à partir du
rapport entre montant initial Stripe et montant initial TND enregistré, sans
utiliser un nouveau taux de change. Les arrondis cumulés garantissent qu'un
remboursement intégral annule exactement les deux parts d'origine.

Une livraison précédant la confirmation du paiement est réessayée. Un événement
incohérent est rejeté. Les événements Stripe réels restent interdits.

## Reçus et vérification

Le PDF client présente le montant payé sans commission. Le PDF professionnel
présente le montant initial, le taux, la retenue, les remboursements éventuels
et le revenu net ; son API contrôle le rôle, le statut et la propriété.
Les identifiants techniques restent internes.

Exécuter `npm run test:payment-accounting` avec PostgreSQL et le serveur local
démarrés. Les appels Stripe sont simulés dans les tests. Les comptes, factures,
notifications et réglages temporaires sont nettoyés ou restaurés.
