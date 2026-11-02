# Espace Client HomeFix TN

Implémentation locale issue de `Cahier_des_charges_HomeFix_TN.docx` (sections 6–8, 11, 14 et indication finale sur l’acompte). Les composants de recherche, filtres et profils professionnels sont conservés ; le profil réutilise les favoris et affiche désormais les créneaux réels publiés par le professionnel.

## Parcours

`/dashboard` : statistiques PostgreSQL, demandes, agenda, raccourcis et entretien.

`/dashboard/demandes` : consultation et suivi uniquement, avec filtres par recherche, statut, professionnel et date. Aucun formulaire de création. Les cartes affichent le créneau, le dernier devis et le lien vers la conversation. L’état vide renvoie vers l’annuaire.

Création depuis `/dashboard/professionnels/:id` : le client choisit un créneau publié dans le calendrier, décrit brièvement le problème et précise l’adresse et les photos facultatives. La demande est liée à un professionnel obligatoire (`professionalId NOT NULL`) et à un fil de conversation. Aucun créneau n’est inventé en l’absence de disponibilités.

Création depuis le chat : le bouton « Demander une intervention » ouvre une boîte de dialogue avec les mêmes créneaux réels et un formulaire court. Une conversation libre ne crée pas de demande d’intervention : les conteneurs de conversation ont `kind=MESSAGE`, `status=CONVERSATION`, tandis que les interventions ont `kind=INTERVENTION` et référencent leur conversation par `conversationId`. Les demandes historiques `QUOTE` sont conservées.

`/professionnel/reservations` : calendrier avec popup par date et panneau des disponibilités et réservations. Une plage publiée est découpée en heures réservables. Modifier les horaires conserve les réservations existantes, même hors de la nouvelle plage. Voir [le fonctionnement de l’agenda](professional-agenda.md).

`/professionnel/demandes`, `/professionnel/messagerie`, `/professionnel/interventions` : acceptation/refus motivé, contre-proposition de créneau, devis détaillé ou révisé, chat, suivi et fin d’intervention. Les écrans des deux rôles utilisent les mêmes données PostgreSQL et contrôles métier.

`/dashboard/messagerie` : conversations persistées, fichiers, partage GPS après consentement explicite, horodatage et état envoyé/lu. Devis, contre-propositions et actions d’intervention intégrés à la conversation. Actualisation toutes les 5 secondes lorsque l’onglet est visible ; aucun indicateur de présence ou de livraison simulé. L’historique des messages utilise un curseur.

`/dashboard/devis` : détail, validité, acceptation, refus, contre-proposition. Le professionnel doit émettre un nouveau devis après négociation. Une acceptation crée le document de suivi du prix et de l’acompte, en millimes entiers.

`/dashboard/reservations` : calendrier des créneaux demandés et réservés, avec accès aux actions de la conversation. La réservation est `PROPOSED` après la demande. Une contre-proposition professionnelle devient `COUNTER_PROPOSED` et doit être acceptée par le client. Le créneau accepté devient `ACCEPTED` tant que le devis ne l’est pas ; il devient `CONFIRMED` seulement lorsque le créneau et le devis sont acceptés, dans l’un ou l’autre ordre. Accepter un devis seul ne confirme donc pas le rendez-vous.

Les créneaux sont interprétés en heure de Tunis. Les transactions Serializable et une contrainte d’exclusion GiST PostgreSQL empêchent les chevauchements dès la nouvelle proposition (`PROPOSED`, `COUNTER_PROPOSED`, `ACCEPTED`, `CONFIRMED`), même lors d’écritures concurrentes. Les anciens rendez-vous et propositions sont conservés par la migration de compatibilité décrite dans [la documentation de l’agenda](professional-agenda.md). Les propositions bloquent leur créneau, mais ne valent pas confirmation : l’accord sur le créneau et le devis reste obligatoire.

`/dashboard/interventions` : historique d’événements et validation de fin par le client. Les statuts en route → en cours → terminée sont réservés au professionnel affecté.

`/dashboard/paiements` et `/dashboard/factures/:id` : montants convenus, acompte de 50 %, montant réellement encaissé, solde, document imprimable/PDF. L’indication de remboursement en cas d’absence figure sur le document.

`/dashboard/avis` : quatre critères après fin validée ; un seul avis par intervention, modération avant publication.

`/dashboard/logement` : équipements, entretiens datés et périodiques. Terminer un entretien périodique crée l’échéance suivante en conservant un jour valide en fin de mois. Les rappels proches ou échus sont calculés dans Notifications.

`/dashboard/favoris`, `/dashboard/notifications`, `/dashboard/profil`, `/dashboard/reclamations` : favoris persistants, lecture des notifications, préférences d’alertes, informations personnelles, photo, changement du mot de passe avec vérification du mot de passe actuel, réclamations et affichage de la réponse enregistrée.

Les listes de demandes sont paginées par 100 avec un lien vers les plus anciennes. Les compteurs du dashboard portent sur toutes les demandes. Les listes secondaires (équipements, favoris, réclamations, notifications) sont actuellement limitées à 100 éléments.

## API et sécurité

- `POST /api/client/espace` : `conversation.open`, `request.create` avec `source=PROFILE|CHAT`, `professionalId` et `slotId` obligatoires ; `booking.accept` pour la contre-proposition et les autres mutations du client actif ; les identifiants du compte viennent exclusivement de la session.
- `GET /api/interactions?before=:id` : demandes du professionnel approuvé affecté (100 par page), avec les coordonnées du client concerné.
- `POST /api/interactions` : `message.send`, `quote.propose`, `booking.confirm`, `booking.counter`, `booking.reject`, `intervention.status` pour le professionnel affecté ; `availability.create` et `availability.remove` pour gérer ses créneaux. Les écrans Professionnel utilisent réellement ces opérations.
- `GET /api/client/professionnels/:id/disponibilites?month=YYYY-MM` : disponibilités publiées encore libres, sans identité des autres clients ni détail des rendez-vous occupés.
- `GET /api/client/conversations/:requestId?after=:messageId` : messages accessibles seulement aux deux participants. `POST` marque les messages reçus comme lus.
- `POST /api/client/fichiers` : multipart (`requestId`, `file`, `chat=true` pour le chat). JPEG, PNG, WebP, MP4 et PDF vérifiés par signature, 8 Mo par fichier et 20 fichiers par demande.
- `GET /api/client/fichiers/:id` : téléchargement privé après vérification du participant, `no-store`, `nosniff`, CSP sandbox. Les octets ne sont jamais inclus dans les données des pages.
- `GET/POST /api/client/photo`, `POST /api/client/compte` : photo privée et mot de passe.

Les mutations vérifient l’origine, le rôle, le propriétaire et les transitions. Les décisions de devis, réservations et confirmations sont atomiques. Les conflits de transaction ou d’exclusion renvoient HTTP 409, sans exposer les détails SQL. Une nouvelle tentative après conflit concurrent reçoit une réponse 409.

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

Les réponses et modérations de l’administration restent à intégrer dans son espace. Les parcours Professionnel de demandes, agenda, messagerie et interventions sont fonctionnels ; les autres modules de cet espace sont conservés.

## Installation et vérification

Conserver Prisma 6.19.3, le générateur existant et PostgreSQL.

```powershell
npm install
npm run db:generate
node node_modules/prisma/build/index.js migrate deploy
node node_modules/typescript/bin/tsc --noEmit
node --test tests/client-domain.test.mjs
# Application démarrée sur localhost:3000 :
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test --test-concurrency=1 tests/client-workspace.integration.test.mjs tests/directory.integration.test.mjs
npm run build
```

Le test d’intégration crée des comptes de test isolés dans la base de développement configurée, exerce les API et nettoie ces comptes dans `finally`. Ne pas l’exécuter sur une base de production.

Sous Windows, un serveur déjà actif peut verrouiller le moteur Prisma pendant `generate`. Arrêter le serveur pour régénérer normalement, puis le relancer. Pendant l’implémentation, le client a été généré dans un dossier temporaire et ses sources actualisées en conservant le même binaire moteur verrouillé.

Les tests d’intégration doivent être exécutés séquentiellement : ils créent et suppriment des comptes qui seraient visibles pendant les assertions de comptage de l’annuaire. Ils vérifient les deux ordres d’acceptation, les propositions alternatives et deux acceptations simultanées, ainsi que le blocage SQL direct d’un chevauchement.
