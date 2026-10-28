# Recherche de professionnels

La page `/dashboard/professionnels` est accessible aux comptes Client actifs. Le tableau de bord et la navigation Client y donnent accès.

## Données et visibilité

La recherche, les profils détaillés et les photos appliquent les mêmes conditions : `role = PROFESSIONAL`, `status = APPROVED`, `isPublic = true` et `termsAccepted = true`. Les listes ne renvoient ni e-mail, ni téléphone, ni document, ni mot de passe. Le téléphone est accessible dans le profil détaillé aux clients connectés.

Les informations historiques en texte libre restent affichées. Les filtres numériques utilisent uniquement les nouveaux champs structurés, facultatifs : `experienceYears`, `priceMin`, `priceMax`. Le professionnel peut les renseigner dans son éditeur de profil, ainsi que sa disponibilité et sa visibilité. Aucune valeur numérique n’est déduite du texte libre.

Les notes sont calculées à partir des lignes `ProfessionalReview` publiées. Aucun avis n’est créé par cette fonctionnalité. Sans avis publié, la note reste absente. Un filtre de note exclut ces profils. Le profil affiche les 20 derniers avis publiés et la moyenne de tous les avis publiés.

## Recherche

`GET /api/client/professionnels` accepte : `q`, `specialty`, `location`, `minExperience`, `maxExperience`, `minRating`, `minPrice`, `maxPrice`, `availability`, `verified`, `sort`, `page`.

Les critères se combinent côté PostgreSQL. La recherche textuelle ignore la casse et les accents français courants et reconnaît plusieurs noms de métiers. Le filtre de budget retient les fourchettes connues qui recoupent le budget demandé. Les profils sans information numérique correspondante ne sont pas inclus lorsqu’un filtre numérique est actif. Les tris placent les valeurs inconnues à la fin et utilisent l’identifiant comme second critère stable. La pagination renvoie 9 profils par page ; une page trop élevée est ramenée à la dernière page disponible.

Les paramètres sont synchronisés dans l’URL. La recherche textuelle attend 350 ms avant d’interroger l’API. Les requêtes précédentes sont annulées lorsque les critères changent.

## Contact et devis

`POST /api/client/demandes` enregistre une demande `MESSAGE` ou `QUOTE`, avec un message de 20 à 3 000 caractères et l’identifiant du professionnel. L’API vérifie l’identité Client, l’origine et la visibilité du destinataire. Elle limite les envois rapprochés à une demande toutes les 30 secondes par client.

Le professionnel consulte les demandes dans `/professionnel/demandes` et les prises de contact dans `/professionnel/messagerie`, puis répond par e-mail ou téléphone. Aucun e-mail n’est envoyé automatiquement et il ne s’agit pas d’un chat en temps réel. Le Client retrouve ses 30 dernières demandes dans `/dashboard` ; le professionnel voit ses 100 dernières demandes.

## Installation et vérification

Sous Windows, arrêtez le serveur Next.js avec `Ctrl+C` avant de régénérer Prisma : son moteur DLL peut rester verrouillé tant que le serveur tourne. La génération est explicite avec `npm run db:generate` ; `npm run dev` démarre uniquement Next.js. Après un clonage ou une modification du schéma, générez le client avant de démarrer le serveur.

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
node --test tests/directory-filters.test.mjs tests/reverse-geocode.test.mjs
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/directory.integration.test.mjs
```

Les tests utilisent Node.js 24 pour charger les fichiers TypeScript. Les tests d’intégration nécessitent PostgreSQL et le serveur Next.js sur `http://localhost:3000` (ou `DIRECTORY_TEST_URL`). Ils consultent les données existantes sans ajouter de professionnels, d’avis ni de messages. Les vérifications HTTP authentifiées utilisent un compte Client actif existant et sont omises en son absence.
