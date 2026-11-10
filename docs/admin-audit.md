# Administration HomeFix TN

Audit du 9 novembre 2026, avant implémentation. Application Next.js 16.3.8, Prisma 6.19.3 et PostgreSQL. Les espaces Client et Professionnel partagent les demandes, réservations, paiements, avis et réclamations.

| Module | État initial | Décision |
| --- | --- | --- |
| Dashboard | Réalisé : compteurs, graphiques, périodes Tunis, activité | Conservé, enrichi avec finance Test, signalements et audit |
| Professionnels | Réalisé : filtres, dossier, justificatif, approbation/refus | Conservé, décisions et accès aux documents journalisés |
| Utilisateurs | Réalisé : liste, recherche, rôles, édition, suspension | Conservé, actions journalisées et motif effacé à réactivation |
| Avis | Partiel : avis Client et Professionnel, aucune modération Admin | Modération motivée, signalements associés au compte, protection contre republication après masquage |
| Messagerie | Absente côté Admin ; échanges Socket.IO existants | Liste sans contenu privé, consultation POST motivée, audit obligatoire avant divulgation, pagination, aucune écriture dans les échanges |
| Réservations | Partiel : disponibles dans les demandes | Vue dédiée avec filtres, lien vers le suivi existant |
| Interventions | Réalisé dans Demandes : statuts, devis, réservation, chronologie | Parcours conservé, accès à la messagerie journalisée ; aucune page dupliquée |
| Paiements | Partiel : Stripe Test Client, webhooks, revenus Professionnel | Tableau Admin, volumes brut/net, remboursements intégraux Test persistants et idempotents |
| Sanctions | Absent | Règles persistantes de référence ; application automatique toujours désactivée côté serveur |
| Réclamations | Partiel : consultation et réponse définitive | Parcours conservé, statuts motivés ; réponse obligatoire avant résolution/clôture |
| Notifications / audit / paramètres | Absents ; entrées désactivées dans la sidebar | Boîte personnelle, dossiers en attente, audit filtrable, paramètres d’équipe persistants |

## Priorités et permissions

1. Vérification du rôle ADMIN côté serveur pour les lectures et actions, et contrôle du statut de suspension. Les JWT vérifiés utilisent HS256 et un identifiant numérique borné.
2. Audit transactionnel des mutations, puis modération et lecture motivée des conversations. Les messages et mots de passe ne sont jamais copiés dans le journal.
3. Finance Stripe Test : vérification du marchand, devise, métadonnées, montant original, clé d’idempotence persistée avant appel Stripe, confirmation avant marquage remboursé. Une réponse réseau incertaine conserve la demande ; une tentative ancienne non résolue est bloquée pour vérification manuelle. Aucun remboursement réel n’est autorisé.
4. Réutilisation du shell premium, des détails de demandes, des réponses aux réclamations et de la gestion des comptes. Ajout de filtres, pagination, états vides et dialogues accessibles pour les nouvelles actions.

## Données et exploitation

Migration additive `20261109220000_admin_operations` : `AdminAuditLog`, `ReviewReport`, `AdminSetting`, `AdminRefund`, et champs de modération des avis. Aucune donnée métier existante supprimée. Les paiements remboursés conservent leurs références historiques ; ils ne peuvent pas être réglés à nouveau. Les webhooks de paiement tardifs ne rétablissent pas une facture remboursée.

La liste de conversations ne révèle aucun texte d’échange. Le lecteur affiche 50 messages par chargement et les métadonnées des pièces jointes, sans télécharger leur contenu. Chaque chargement exige le motif et écrit les identifiants des messages dans l’audit. Le journal est append-only dans l’application ; l’accès direct PostgreSQL reste sous la responsabilité de l’exploitation.

Les paramètres d’assistance sont internes à l’équipe ; aucun envoi d’e-mail n’est intégré. Les notifications utilisent la table PostgreSQL existante et les alertes dynamiques des dossiers à traiter. Les actions Admin notifient les autres administrateurs ayant activé les notifications. Les sanctions ne sont jamais automatiques.

Références Stripe utilisées : https://docs.stripe.com/api/refunds/create et https://docs.stripe.com/api/idempotent_requests.

## Vérification

Lancer le serveur avec `npm run dev`, puis `npm run test:admin`. Le lanceur charge les mêmes fichiers d’environnement que Next.js. Les tests utilisent des comptes temporaires sur la base configurée et les nettoient ensuite. Les tests de remboursement utilisent un double Stripe local au processus ; aucun remboursement externe n’est exécuté par les tests. `npm run build` vérifie également TypeScript.

Le listener `npm run stripe:listen` inclut les événements `refund.created`, `refund.updated` et `refund.failed`. En environnement hébergé, sélectionner également ces événements dans la configuration du webhook Stripe Test. Le bouton « Vérifier dans Stripe » réconcilie une demande en attente si le webhook n’a pas été reçu.

Contrôles effectués : build de production et TypeScript, ESLint sur les fichiers touchés, 11 tests Admin, suites existantes paiements/Elements, notifications, annuaire, profil et parcours Client–Professionnel. Les pages sont vérifiées par HTTP authentifié, y compris l’absence de texte privé dans le HTML avant autorisation. Limites : aucun test visuel de navigateur disponible dans cet environnement, et les remboursements sont validés avec PostgreSQL réel et un double Stripe, sans exécuter d’opération sur le compte Stripe de l’utilisateur.
