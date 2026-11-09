# Assistant conversationnel HomeFix TN

La page `/dashboard/assistant` utilise Gemini côté serveur via REST, sans SDK supplémentaire. Les cartes proviennent uniquement de PostgreSQL et sont actualisées à chaque lecture : un professionnel devenu non approuvé ou non public disparaît de l’historique.

## Configuration

Dans `.env.local` (ignoré par Git), renseigner une clé créée dans [Google AI Studio](https://aistudio.google.com/apikey) :

```dotenv
GEMINI_API_KEY=votre_cle
GEMINI_MODEL=gemini-3.5-flash-lite
```

Le modèle par défaut prend en charge les appels de fonctions et dispose d’une offre gratuite, selon l’éligibilité du projet Google. Les quotas changent : consulter [la tarification](https://ai.google.dev/gemini-api/docs/pricing) et [les limites](https://ai.google.dev/gemini-api/docs/rate-limits). L’application ne peut pas garantir la gratuité d’une clé liée à un projet facturé. Aucun repli automatique vers un modèle payant.

```sh
npx prisma migrate deploy
npx prisma generate
npm run dev
```

En cas de DLL Prisma verrouillée sous Windows, arrêter le processus de développement qui utilise ce dépôt avant de régénérer, puis le relancer. Ne jamais exposer la clé sous un nom `NEXT_PUBLIC_*`.

## Fonctionnement

- `GET /api/client/assistant` récupère la dernière conversation privée et les 40 derniers titres. `?conversationId=...` sélectionne une conversation appartenant au client. `?list=1&cursor=...` charge la page suivante de titres sans charger leurs messages.
- « Nouvelle conversation » ouvre un chat vide uniquement dans l’interface, sans enregistrement en base. `POST` avec `{action:"create"}` renvoie également un chat temporaire avec `id:null`, sans création de ligne. Avec `{message, conversationId?}`, le premier échange réussi enregistre une nouvelle conversation ; un échec Gemini ne laisse aucun historique vide. Les conversations vides des anciennes versions sont exclues de l’historique et de la sélection par défaut. L’historique fourni par le navigateur n’est jamais accepté. Le premier message crée automatiquement un titre court ; un titre renommé reste conservé.
- L’outil `search_professionals` valide spécialité, ville et budget, interroge PostgreSQL puis renvoie les résultats au modèle. Le budget peut être `null` si le client choisit de ne pas le préciser.
- La spécialité, l’approbation et la couverture de la ville enregistrée dans le profil client sont obligatoires. Le serveur impose cette ville, même si le modèle ou un ancien message indique une autre ville. Sans ville enregistrée, le client est invité à compléter Mon profil. Les tarifs compatibles avec le budget sont proposés en priorité ; à défaut, seuls des profils de cette même zone peuvent être proposés avec le dépassement du budget clairement signalé. Les prix inconnus restent sur devis. Les critères sont conservés avec le message ; les avertissements sont recalculés avec les données actuelles à chaque lecture. Le score combine créneau libre (25), disponibilité déclarée (8/4), note (5 par point), volume d’avis (jusqu’à 10), expérience (jusqu’à 20), tarif de départ compatible (15). Les ex æquo sont départagés par identifiant. Ces critères ne garantissent ni le prix final ni la disponibilité.
- Les créneaux actifs des 30 prochains jours sont comparés à toutes les réservations bloquantes du professionnel, y compris celles sans lien direct avec un créneau.
- L’outil `respond` termine avec des conseils et une analyse structurée. Les identifiants ou cartes ajoutés par le modèle sont ignorés. Les informations professionnelles sont rendues dans les cartes alimentées par le serveur.
- `PATCH` avec `{conversationId, title}` renomme uniquement une conversation appartenant au client. `DELETE` avec `{conversationId}` supprime cette seule conversation après confirmation dans l’interface. Une conversation en cours de réponse ne peut pas être renommée ou supprimée.

## Interface

Le chat occupe la hauteur disponible dans le shell client, sans défilement du document. La sidebar et les messages ont chacun leur défilement indépendant. La saisie reste visible en bas du chat, y compris lorsque le clavier mobile réduit la hauteur disponible. Sur mobile, l’historique s’ouvre dans un dialogue latéral avec fermeture par Échap et gestion native du focus.

Les brouillons et positions de lecture sont préservés pendant les changements de conversation dans la page ouverte. Le défilement suit les nouveaux échanges uniquement lorsque le client se trouve près du bas. Lorsqu’il lit des anciens messages, sa position reste stable et un bouton permet de revenir aux derniers messages. La description améliorée et son bouton de copie apparaissent dans chaque réponse concernée. Les consignes de sécurité sont intégrées aux réponses et à une note compacte dans le chat vide.

La migration `20261109120000_assistant_conversation_titles` ajoute les titres sans effacer les historiques existants. Redémarrer le serveur après migration et génération Prisma pour charger le schéma actualisé.

## Assistant flottant

Toutes les pages de l’espace Client, sauf la page Assistant IA elle-même, affichent un bouton flottant avec la même icône Sparkles que la navigation. Chaque ouverture démarre un nouveau chat vide dans une version compacte du composant `AssistantChat`. Les anciennes discussions restent accessibles dans son historique, avec les mêmes API et cartes de professionnels. Aucun historique vide n’est enregistré. Une réponse déjà en cours peut se terminer lorsque le panneau est réduit ; elle appartient toujours à son ancienne conversation. Les changements de page pendant que le panneau est ouvert préservent le chat courant. Le bouton d’agrandissement ouvre `/dashboard/assistant`.

Le panneau dispose de sa propre saisie et de sa propre zone de défilement. Il ne bloque pas le défilement des pages environnantes. Les styles qui fixent la hauteur du shell s’appliquent uniquement à la page complète de l’assistant. La hauteur du panneau s’adapte au viewport visible et au clavier mobile. Échap réduit le panneau et rend le focus au bouton ; les dialogues d’historique et de renommage conservent leur propre gestion du focus. Le widget est masqué à l’impression.

## Protections et conservation

Authentification et état du compte vérifiés en base, contrôle d’origine, JSON limité à 16 Ko, message limité à 3 000 caractères, réponses en texte React sans HTML, clés et erreurs internes jamais renvoyées. Profils approuvés, publics et ayant accepté les conditions uniquement. Les avis privés sont exclus. Aucun nom, adresse, téléphone ou e-mail du compte client n’est automatiquement envoyé à Google. Le texte saisi et les champs publics des profils trouvés sont transmis à Google ; l’interface prévient le client d’éviter les données personnelles. Vérifier les conditions Google concernant les données de l’offre gratuite avant une mise en production.

Les quotas atomiques PostgreSQL persistent entre les redémarrages et sont partagés entre instances : 6 tours/minute/client, 60/jour/client, 150/jour pour l’application. Chaque tour consomme au maximum 4 appels Gemini, dont une seule nouvelle tentative en cas de surcharge HTTP 503. Ces plafonds applicatifs ne remplacent pas les quotas de Google ; un HTTP 429 inclut `Retry-After`. Les échecs consomment le quota applicatif pour limiter les abus. Les fenêtres journalières sont en UTC.

Les appels Gemini sont limités à 45 secondes au total. Une seule nouvelle tentative est effectuée après 800 ms en cas de surcharge HTTP 503, dans le même délai total. Les erreurs de quota HTTP 429 ne sont pas retentées. Si la surcharge persiste, une réponse 503 avec Retry-After de 15 secondes est renvoyée et le chat temporise les envois. Un verrou temporaire empêche deux réponses concurrentes de modifier le même historique. Une conversation est limitée à 30 tours afin de conserver tout son contexte sans troncature silencieuse ; ouvrir ensuite une nouvelle conversation. Après 30 jours d’inactivité, une conversation n’est plus exposée et elle est supprimée lors de la prochaine requête POST du propriétaire. Pour imposer une suppression physique à date fixe, planifier une purge de `AssistantConversation.updatedAt` ; aucune tâche planifiée n’est installée.

Une détection locale prudente de signes de danger gaz/électricité renvoie immédiatement des consignes de sécurité, sans attendre Gemini et même sans clé. Elle complète les instructions de sécurité du modèle ; elle ne constitue pas un diagnostic ni un système de secours.

## Vérification

```sh
node --import ./tests/helpers/register-ts.mjs --test tests/assistant.test.mjs
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/assistant-directory.integration.test.mjs
# Serveur démarré sur le port 3100 (ou variable ASSISTANT_TEST_URL) :
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/assistant-http.integration.test.mjs
npx tsc --noEmit
npm run build
```

Les tests unitaires simulent les réponses du fournisseur sans connexion Google. Les tests d’intégration interrogent les enregistrements existants sans ajouter de professionnels fictifs. Un véritable échange Gemini nécessite une clé valide et un quota disponible.
