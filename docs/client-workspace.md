# Espace Client HomeFix TN

Implémentation locale issue de `Cahier_des_charges_HomeFix_TN.docx` (sections 6–8, 11, 14 et indication finale sur l’acompte). Les composants de recherche, filtres et profils professionnels sont conservés ; le profil reçoit seulement les actions favoris et attribution d’une demande existante.

## Parcours

`/dashboard` : statistiques PostgreSQL, demandes, agenda, raccourcis et entretien.

`/dashboard/demandes` : titre, catégorie, urgence, description, adresse, disponibilités, équipement et pièces jointes. Une demande sans professionnel est enregistrée sans être diffusée. Depuis le profil d’un professionnel, le client peut lui transmettre une demande existante. En cas d’échec d’un fichier, la demande reste enregistrée et l’envoi peut être repris.

`/dashboard/messagerie` : conversations persistées, fichiers, partage GPS après consentement explicite, horodatage et état envoyé/lu. Actualisation toutes les 5 secondes lorsque l’onglet est visible ; aucun indicateur de présence ou de livraison simulé. L’historique des messages utilise un curseur.

`/dashboard/devis` : détail, validité, acceptation, refus, contre-proposition. Le professionnel doit émettre un nouveau devis après négociation. Une acceptation crée le document de suivi du prix et de l’acompte, en millimes entiers.

`/dashboard/reservations` : calendrier, proposition et modification d’un créneau, confirmation professionnelle, annulation motivée. Les créneaux sont interprétés en heure de Tunis. Les chevauchements et mutations concurrentes sont contrôlés dans une transaction Serializable. Les modifications d’un créneau commencé passent par l’assistance.

`/dashboard/interventions` : historique d’événements et validation de fin par le client. Les statuts en route → en cours → terminée sont réservés au professionnel affecté.

`/dashboard/paiements` et `/dashboard/factures/:id` : montants convenus, acompte de 50 %, montant réellement encaissé, solde, document imprimable/PDF. L’indication de remboursement en cas d’absence figure sur le document.

`/dashboard/avis` : quatre critères après fin validée ; un seul avis par intervention, modération avant publication.

`/dashboard/logement` : équipements, entretiens datés et périodiques. Terminer un entretien périodique crée l’échéance suivante en conservant un jour valide en fin de mois. Les rappels proches ou échus sont calculés dans Notifications.

`/dashboard/favoris`, `/dashboard/notifications`, `/dashboard/profil`, `/dashboard/reclamations` : favoris persistants, lecture des notifications, préférences d’alertes, informations personnelles, photo, changement du mot de passe avec vérification du mot de passe actuel, réclamations et affichage de la réponse enregistrée.

Les listes de demandes sont paginées par 100 avec un lien vers les plus anciennes. Les compteurs du dashboard portent sur toutes les demandes. Les listes secondaires (équipements, favoris, réclamations, notifications) sont actuellement limitées à 100 éléments.

## API et sécurité

- `POST /api/client/espace` : mutations du client actif ; les identifiants du compte viennent exclusivement de la session.
- `GET /api/interactions?before=:id` : demandes du professionnel approuvé affecté (50 par page), avec les coordonnées du client concerné.
- `POST /api/interactions` : `message.send`, `quote.propose`, `booking.confirm`, `intervention.status` pour le professionnel affecté. Cette API prépare les échanges sans modifier les interfaces Admin/Professionnel existantes.
- `GET /api/client/conversations/:requestId?after=:messageId` : messages accessibles seulement aux deux participants. `POST` marque les messages reçus comme lus.
- `POST /api/client/fichiers` : multipart (`requestId`, `file`, `chat=true` pour le chat). JPEG, PNG, WebP, MP4 et PDF vérifiés par signature, 8 Mo par fichier et 20 fichiers par demande.
- `GET /api/client/fichiers/:id` : téléchargement privé après vérification du participant, `no-store`, `nosniff`, CSP sandbox. Les octets ne sont jamais inclus dans les données des pages.
- `GET/POST /api/client/photo`, `POST /api/client/compte` : photo privée et mot de passe.

Les mutations vérifient l’origine, le rôle, le propriétaire et les transitions. Les décisions de devis, réservations et confirmations sont atomiques. Une nouvelle tentative après conflit concurrent reçoit une réponse 409.

## Services externes à raccorder

Le dépôt ne possède pas de prestataire de paiement. Aucun bouton ne simule un débit, aucun paiement n’est marqué réussi et aucun remboursement n’est présenté comme exécuté. Le règlement de l’acompte et son remboursement effectif nécessitent un PSP, des webhooks vérifiés, des clés d’idempotence et le traitement des litiges. Le document actuel est explicitement un suivi du prix convenu, pas un reçu de paiement.

L’assistant utilise un adaptateur IA externe configurable ; aucun moteur par mots-clés n’est présenté comme une IA. Définir dans l’environnement serveur :

```dotenv
HOMEFIX_AI_URL=https://votre-service-ia/clarifier
HOMEFIX_AI_KEY=cle-serveur
HOMEFIX_AI_MODEL=modele-configure
```

Contrat de l’adaptateur : POST JSON `{ model, description, categories, language: "fr" }`, authentification Bearer. Réponse `{ category, description }` ; la catégorie doit appartenir à la liste fournie et le texte doit contenir 20 à 3 000 caractères. L’adresse, le GPS et l’identité ne sont pas transmis. Sans ces variables, l’interface signale l’indisponibilité. Ce contrat nécessite un adaptateur ; ce n’est pas une intégration directe à un fournisseur particulier.

Les notifications et rappels sont internes à l’espace. Aucun SMS, e-mail, push ni tâche planifiée d’envoi ne sont configurés. La préférence d’alertes coupe la création des nouvelles notifications de projet ; l’historique et les rappels d’entretien restent consultables.

Les fichiers sont stockés dans PostgreSQL, avec limites, pour fonctionner avec l’infrastructure actuelle. Un stockage objet privé pourra remplacer les octets en base. La messagerie utilise le polling, sans infrastructure WebSocket.

Les réponses/modérations de l’administration et les boutons de gestion côté Professionnel restent à intégrer dans leurs espaces respectifs ; leurs interfaces existantes n’ont pas été refaites.

## Installation et vérification

Conserver Prisma 6.19.3, le générateur existant et PostgreSQL.

```powershell
npm install
npm run db:generate
node node_modules/prisma/build/index.js migrate deploy
node node_modules/typescript/bin/tsc --noEmit
node --test tests/client-domain.test.mjs
# Application démarrée sur localhost:3000 :
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/client-workspace.integration.test.mjs tests/directory.integration.test.mjs
npm run build
```

Le test d’intégration crée des comptes de test isolés dans la base de développement configurée, exerce les API et nettoie ces comptes dans `finally`. Ne pas l’exécuter sur une base de production.

Sous Windows, un serveur déjà actif peut verrouiller le moteur Prisma pendant `generate`. Arrêter le serveur pour régénérer normalement, puis le relancer. Pendant l’implémentation, le client a été généré dans un dossier temporaire et ses sources actualisées en conservant le même binaire moteur verrouillé.
