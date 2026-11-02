# HomeFix TN ? Paiement int?gr? et avis

## Interface

Le formulaire utilise Stripe Payment Element avec PaymentIntents. Aucun nouveau paiement ne passe par Stripe Checkout. Les champs nom du titulaire, num?ro de carte, expiration et CVC sont dans une iframe Stripe ; aucune donn?e bancaire n?est envoy?e ? une API HomeFix. Le nom est demand? avec `fields.billingDetails.name: always`.

Link, Apple Pay et Google Pay sont d?sactiv?s. Le PaymentIntent n?autorise que la carte. L?apparence Stripe reprend les couleurs, bordures et espacements HomeFix. L?adresse de facturation est demand?e uniquement si Stripe l?exige (`if_required`). Une authentification 3D Secure peut appara?tre ; `redirect: if_required` ?vite une redirection apr?s un paiement carte classique.

Le r?capitulatif affiche uniquement le solde ? payer en TND, apr?s d?duction des acomptes. Les taux et montants techniques ne sont plus renvoy?s dans le r?sum? public ni affich?s dans le formulaire ou la facture HomeFix. Le paiement est explicitement une simulation, sans d?bit r?el.

## Devise r?elle

V?rification en lecture seule du compte Test configur? : pays **US**, **TND non accept?**, **EUR accept?**. Les nouveaux PaymentIntents utilisent donc actuellement **EUR** avec `STRIPE_TEST_CURRENCY=eur`. Le serveur d?duit l?acompte en millimes, applique le taux de d?monstration priv? et arrondit une seule fois au centime. Il stocke le solde TND, la devise r?ellement pr?sent?e ? Stripe, le montant Stripe et le taux dans PostgreSQL.

L?affichage TND est une pr?sentation de simulation, pas une affirmation d?encaissement TND. Aucun paiement r?el n?est autoris?. Une future activation r?elle n?cessiterait un compte et une devise compatibles ainsi que l?affichage transparent de la devise d?bit?e avant confirmation. Aucun m?canisme de ce projet n?active le mode r?el.

## Configuration

Les variables sont document?es dans `config/stripe-test.env.example` et d?finies dans `.env`, ignor? par Git :

```dotenv
APP_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_CURRENCY=eur
STRIPE_TEST_EXCHANGE_RATE=0.30
```

Le taux est exclusivement un taux fixe de d?monstration. La cl? secr?te, le secret webhook et le taux ne doivent pas porter le pr?fixe `NEXT_PUBLIC_`. Les cl?s r?elles sont refus?es, m?me en production.

D?marrage local :

```powershell
npm run stripe:setup
npm run dev
# Second terminal, ? conserver ouvert :
npm run stripe:listen
```

Le script local masque les secrets et enregistre le secret de signature dans `.env`. Red?marrer le serveur apr?s un changement de ce secret. Un ancien listener doit ?tre relanc? pour prendre en compte les ?v?nements PaymentIntent ajout?s.

## Backend et webhook

`POST /api/client/paiements` accepte uniquement l?identifiant d?intervention. Le serveur v?rifie l?utilisateur, la propri?t? de la facture, le prix accept?, la fin de l?intervention et le solde. La r?ponse priv?e non mise en cache contient le client secret uniquement pour le client propri?taire. Ce secret n?est jamais enregistr? dans le stockage navigateur ou les journaux.

Un verrou PostgreSQL sur la facture s?rialise les d?cisions. La tentative est persist?e avant l?appel Stripe et fournit une cl? d?idempotence stable. Les clics concurrents, onglets, refus de carte et coupures r?seau r?utilisent le m?me PaymentIntent. Un refus conserve la tentative ouverte : cr?er un nouvel intent laisserait l?ancien confirmable. Un intent d?j? r?ussi ou en traitement attend le webhook. Une annulation confirm?e par Stripe permet une nouvelle tentative. Une cr?ation incertaine depuis plus de 23 heures n?cessite une v?rification d?assistance, pour ne pas d?passer la garantie d?idempotence Stripe.

Les anciennes sessions Checkout ouvertes sont expir?es avant de cr?er un PaymentIntent. Si leur cr?ation ?tait incertaine, elles sont r?cup?r?es avec leur payload et cl? d?origine avant expiration. Une session termin?e reste en attente de confirmation pour ?viter un second paiement. Les anciens webhooks Checkout restent compatibles.

`POST /api/stripe/webhook` v?rifie la signature sur le corps brut. ?v?nements n?cessaires :

- `payment_intent.succeeded`
- `payment_intent.processing`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- Les quatre anciens ?v?nements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` pendant la transition.

Le gestionnaire recharge l?intent Stripe et v?rifie le compte marchand, le mode Test, les m?tadonn?es, l?identifiant, la devise, le montant attendu et le montant re?u. La transaction d?duplique les ?v?nements et confirme une seule fois la facture, l?historique et les notifications. Un ?v?nement tardif ne r?trograde jamais un r?glement confirm?.

Le retour navigateur n?accorde aucun statut pay?. Les pages `/dashboard/paiements/[id]`, `/succes` et `/annulation` v?rifient la propri?t? de l?intervention. La page attend le statut PostgreSQL confirm? par webhook avant d?afficher le re?u et de proposer l?avis. Le suivi combine Socket.IO, actualisation p?riodique et bouton d?actualisation.

## V?rification

Carte de test : `4242 4242 4242 4242`, date future, CVC ? trois chiffres. Carte refus?e : `4000 0000 0000 0002`. Authentification requise : `4000 0025 0000 3155`. Ne jamais utiliser une carte r?elle.

```powershell
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test --test-concurrency=1 tests/card-payments.integration.test.mjs tests/payment-rules.test.mjs tests/payments.integration.test.mjs tests/request-origin.test.mjs
npm run build
```

Les tests utilisent PostgreSQL et des doubles Stripe isol?s du code applicatif. Ils couvrent les acomptes, la conversion priv?e, les acc?s, les signatures, l?idempotence, la migration Checkout, les refus et les ?v?nements en double ou dans le d?sordre.

R?f?rences officielles : [Payment Element](https://docs.stripe.com/payments/payment-element), [champs du formulaire](https://docs.stripe.com/js/elements_object/create_payment_element), [confirmation](https://docs.stripe.com/js/payment_intents/confirm_payment), [devises](https://docs.stripe.com/currencies), [webhooks](https://docs.stripe.com/webhooks).

### V?rification navigateur effectu?e

V?rifi? dans Chrome avec de vraies API Stripe Test : champs en fran?ais (y compris le nom du titulaire), refus de la carte `4000 0000 0000 0002`, reprise sur la m?me tentative avec `4242 4242 4242 4242`, ?v?nement `payment_intent.succeeded` re?u avec HTTP 200, facture PostgreSQL confirm?e, formulaire d?avis d?bloqu?. Le rendu a ?t? contr?l? ? 1440 px et 390 px, sans d?bordement horizontal. Les donn?es applicatives de d?monstration ont ?t? supprim?es apr?s v?rification.
