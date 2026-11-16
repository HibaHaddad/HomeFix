# Sanctions des professionnels

Les sanctions sont des écritures comptables et des ajustements de notation.
Aucun paiement Stripe, remboursement, commission, avis client ou virement n'est
modifié par une décision de sanction.

## Détection et examen

Les règles PostgreSQL `SanctionRule` définissent trois barèmes : retard supérieur
à 30 minutes (1 étoile), absence (20 DT), non-réalisation (30 DT). Chaque règle
peut être modifiée ou désactivée dans Admin > Sanctions > Règles. Les dossiers
conservent le barème proposé à leur création ; une règle désactivée ne peut
plus être validée. Les changements ne recalculent pas les sanctions existantes.

La détection s'exécute lors de l'ouverture de la page Admin, sur demande avec
« Actualiser les incidents », après les mises à jour de suivi et après une
réclamation liée à une intervention. Les rendez-vous écoulés sont ainsi examinés
à la prochaine consultation Admin, sans dépendre d'un cron extérieur.

- Retard : premier événement professionnel IN_PROGRESS comparé au début prévu.
  Ce signal représente un début déclaré, pas une preuve d'arrivée géolocalisée.
- Absence : rendez-vous confirmé terminé sans début ni fin professionnels
  enregistrés. Un rendez-vous simplement proposé ne suffit pas.
- Non-réalisation : intervention engagée, puis contestée ou annulée sans motif
  enregistré ; les réclamations sont des allégations à vérifier.

Ces signaux créent seulement des dossiers PENDING. L'Admin doit examiner les
horaires, événements, réclamations et justificatifs, confirmer cet examen et
fournir un motif avant application. Il peut aussi refuser le dossier.

Une clé unique intervention/famille empêche de compter deux fois le même
incident, y compris après refus ou annulation. Absence et non-réalisation
partagent une seule famille. Les décisions et contestations sont sérialisées
par un verrou PostgreSQL et historisées dans `SanctionHistory` et l'audit Admin.

## Effets et contestations

Le solde professionnel est calculé à partir des revenus nets après commissions
et remboursements, moins les sanctions financières APPLIED. Il peut devenir
négatif ; aucun débit bancaire n'est exécuté. Les pénalités restent séparées
des commissions et ne sont pas ajoutées au revenu de commission HomeFix.

La note ajustée est `max(1, moyenne originale - pénalités actives)`. Sans avis
noté, aucune note artificielle n'est créée. L'annuaire, les profils publics et
les recommandations utilisent la note ajustée ; les vrais avis sont conservés.

Le professionnel reçoit une notification et peut contester une fois une
sanction appliquée. La sanction reste active pendant l'examen. L'Admin peut la
maintenir ou accepter la contestation, ce qui annule la sanction. Une annulation
restaure immédiatement les vues de solde et de notation tout en conservant
l'historique. Les interfaces relisent ces données lors de leur actualisation.

## Vérifications

`npm run test:sanctions` utilise PostgreSQL et le serveur local. Les fixtures,
notifications et règles temporaires sont nettoyées ou restaurées. Les tests
couvrent rôles, désactivation, détection, absence de double application,
contestation, maintien, annulation, note minimale et calculs financiers.
