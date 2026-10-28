# HomeFix TN — la maison vivante

La page `/` utilise Three.js, React Three Fiber, Drei et GSAP ScrollTrigger. Les espaces authentifiés ne sont pas modifiés.

## Référence et modèles

La vidéo locale fournie a été examinée : composition crème, typographie éditoriale, sujets 3D au premier plan et transitions liées au défilement. La nouvelle direction transpose ces principes à une maison en coupe et trois métiers.

Tous les modèles de la maison, du mobilier, des plantes, des outils et des professionnels sont des géométries originales définies dans `src/components/landing/HouseModels.tsx`. Aucun GLB, texture, avatar, HDRI distant ou modèle tiers n’est nécessaire. Il n’y a donc pas de licence de modèle externe à attribuer. Les dépendances conservent leurs propres licences.

## Fonctionnement

- Le texte et les liens sont rendus immédiatement. Le moteur 3D est chargé dans un module client distinct.
- `useHouseStory.ts` contient l’unique timeline GSAP avec ScrollTrigger et `scrub`. Un même playhead pilote la caméra, la toiture, l’orientation de la maison, les entrées/sorties des textes et l’indicateur du chapitre.
- Une seule scène sticky conserve le canvas et les modèles entre tous les chapitres. La grille sépare le texte (40 %) du visuel (60 %) sur desktop ; sur mobile, le texte et le visuel occupent deux rangées distinctes.
- Chaque chapitre comporte un temps de lecture et une transition synchronisée. Les textes glissent dans une zone masquée sans se superposer. Les liens de chapitre, les ancres de la navbar et celles du footer rejoignent la bonne position de cette même timeline.
- Les gestes des professionnels sont animés aux articulations. Les gouttes et les courants d’air sont animés dans la scène.
- L’éclairage d’environnement est généré localement avec Drei ; aucun CDN n’est nécessaire.
- La scène réduit sa résolution et désactive les ombres directionnelles sur mobile. Elle cesse de tourner lorsqu’elle est hors écran ou que l’onglet est masqué.
- Le bouton Pause arrête les animations automatiques. Le scroll reste utilisable pour parcourir les services.
- `prefers-reduced-motion` conserve un cadrage statique et désactive les mouvements automatiques.
- Un visuel SVG et l’intégralité des liens restent accessibles si WebGL 2 est indisponible. La perte du contexte graphique dispose aussi d’un fallback.

## Validation locale

`npm run build` et `npx tsc --noEmit` vérifient la compilation. Pour examiner exactement la version compilée, utiliser `npm run start -- --port 3100` et ouvrir `http://localhost:3100`.

Après une reconstruction, redémarrer un éventuel serveur `next start` déjà ouvert : un ancien processus peut garder l’ancien HTML en mémoire alors que les bundles ont changé.

Contrôles effectués sur la nouvelle composition : captures Chrome en 1440, 390 et 320 px, puis Edge en 768 et 1024 px. Les sept poses de caméra correspondent aux sept chapitres, avec un seul canvas conservé pendant le parcours. Les contrôles couvrent aussi l’absence de superposition des textes pendant les transitions, les ancres de navigation, les liens directs vers un chapitre, le focus clavier, les étapes dépliables, la pause, le mode mouvement réduit, le fallback sans WebGL et la navigation vers l’inscription.
