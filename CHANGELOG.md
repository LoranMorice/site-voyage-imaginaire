# Journal des versions

Toutes les modifications notables du site sont consignées ici.

---

## Version 1.3 — 29 septembre 2026

Console des légendes : un outil d'administration pour renseigner les
légendes des cinq dossiers sans éditer les `legendes.txt` à la main.

### Outil admin (`admin.html`)

- Page protégée par le mot de passe horaire des espaces privés
  (`JJMMAAAAHH:MM`, tolérance de 3 minutes)
- Relie le dossier `Voyage-en-Imaginaire` via l'API File System Access
  (Chrome/Edge) ; le dossier choisi est mémorisé dans IndexedDB
- Chaque onglet affiche une vignette par fichier, avec un champ de légende
  encadré ; l'en-tête des `legendes.txt` est préservé
- Enregistrement direct dans le `legendes.txt` du dossier concerné, avec
  indicateur d'état (modifié / enregistré)
- Page non indexée, mais accessible depuis le menu du site par un bouton
  discret

### Divers

- Bouton « 🔑 Légendes (admin) » ajouté au menu latéral du site
- Numéro de version affiché en bas du menu

## Version 1.2 — 29 septembre 2026

Réétiquetage de la version 1.1.0 : l'étiquette publique du site passe à
« Version 1.2 ». Aucun changement fonctionnel (les deux étiquettes `v1.1.0`
et `v1.2` pointent vers la même version).

## Version 1.1.0 — 29 septembre 2026

Page d'accueil vivante et changement de nom d'auteur.

- Nom d'auteur : Laurent GANNE devient **LoranG** partout
- Astre animé : le soleil suit une trajectoire d'est en ouest selon l'heure
  réelle (lever ~7 h à gauche, zénith à midi, coucher ~19 h à droite),
  la lune prend le relais la nuit
- L'heure courante s'affiche au centre de l'astre au format HH:MM,
  rafraîchie chaque minute
- La luminosité de l'accueil suit le moment de la journée

## Version 1.0.4 — 27 septembre 2026

Correction : le site ne crée plus de dossiers par erreur, et ajout d'un
outil de diagnostic.

- Le dossier choisi est vérifié : il doit contenir au moins un des cinq
  sous-dossiers attendus, sinon la liaison est refusée
- Même contrôle au redémarrage ; un dossier mémorisé invalide est oublié
- Les lectures n'utilisent plus `create: true` ; seul l'export entre
  onglets peut encore créer un dossier de destination
- `diagnostic.html` : vérifie l'autorisation d'accès, compte les fichiers
  lisibles, signale les fichiers rejetés et indique le mode de démarrage
- README : nouvelle section « En cas de problème »

## Version 1.0.3 — 27 septembre 2026

Renommage du morceau audio.

- « Projet du siecle 1-2 copie MP3.mp3 » devient `le-siecle.mp3`
- Légende affichée : « Le Siècle... »
- Adresse web désormais lisible : `medias/audio/le-siecle.mp3`

## Version 1.0.2 — 27 septembre 2026

Ajout du premier morceau dans l'onglet Audio.

- « Projet du siècle » : MP3 stéréo, 192 kbps, 1 min 01 s, 1,4 Mo
  (bounce Logic Pro)
- Légende renseignée dans `3-Audio/legendes.txt`
- Le projet Logic (.logicx, 52 Mo) reste dans la base locale : ni affiché
  par le site, ni publié
- La galerie compte désormais 29 médias pour 19 Mo : 8 photos,
  20 graphismes, 1 piste audio

## Version 1.0.1 — 27 septembre 2026

Première galerie publiable : 28 médias préparés pour le web.

- 1-Photo : 8 images · 2-Graphi : 20 images · 3-Audio : vide
- 21 fichiers HEIC convertis en JPEG (originaux conservés sur le Bureau)
- PNG opaques convertis en JPEG à la publication ; « manequin N&B » passe
  de 35 Mo à 1,2 Mo
- Qualité JPEG portée de 82 à 88 pour préserver les dégradés sombres
- Mode lecture seule (Firefox, Safari) : les sous-dossiers d'originaux sont
  désormais ignorés
- Message explicite lorsqu'une image est refusée par le navigateur, au lieu
  d'une vignette cassée

## Version 1.00 — 25 septembre 2026

Première version complète. Site personnel privé, prêt pour une publication
publique des onglets Photo, Graphi et Audio.

### Structure

- Portail d'entrée protégé par mot de passe, sans indice de format affiché
- Menu en colonne à gauche : Accueil, puis les 5 onglets numérotés
- Page d'accueil avec papier peint « coucher de soleil » et texte de titre
- Bouton en forme de porte, dans chaque onglet, pour revenir à l'accueil
- Cinq onglets : 1 Photo · 2 Graphi · 3 Audio · 4 Perso · 5 Réserves

### Accès

- Entrée du site : date du jour au format `JJMMAAAA`
- Onglets Perso et Réserves : date, heure et minutes `JJMMAAAAHH:MM`,
  avec une tolérance de 3 minutes
- Aucun indice de format n'est affiché à l'écran

### Consultation

- Défilement des médias aux flèches ← et →, en boucle
- Diaporama automatique, une vue toutes les 8 secondes, avec barre de
  progression ; en Audio, attend la fin du morceau
- Légendes affichées sous les images, issues d'un fichier `legendes.txt`
  ou déduites du nom de fichier
- Accès direct aux onglets par les touches 1 à 5, retour à l'accueil par Échap
- Choix du papier peint depuis n'importe quelle image de la galerie

### Base de données locale

- Les cinq dossiers de `Bureau/Voyage-en-Imaginaire/` sont la source unique
- Lecture directe du disque, sans catalogue à tenir à jour
- Rafraîchissement automatique à l'ouverture d'un onglet
- Déplacement réel de fichiers depuis Perso et Réserves vers Photo, Graphi
  ou Audio, par le bouton « Exporter vers »

### Publication

- `publier.command` : prépare la version publique en un double-clic
- Conversion automatique des images HEIC et TIFF en JPEG
- Réduction des images à 2000 px de côté
- Génération de `catalogue.json` et du dossier `medias/`
- Les dossiers Perso et Réserves ne sont jamais lus par cet outil
- En mode public, les onglets Perso et Réserves n'existent pas

### Technique

- HTML, CSS et JavaScript seuls : aucune dépendance, aucune compilation
- Mode atelier via l'API File System Access (Chrome ou Edge)
- Mode lecture seule de secours pour Safari et Firefox
- Fond d'écran vectoriel de 5 Ko, net à toutes les résolutions

### Limite connue

Les mots de passe sont vérifiés dans le navigateur : ils constituent un
seuil, non une protection cryptographique. Les fichiers publiés dans
`medias/` sont accessibles par leur adresse directe. Seuls les dossiers
Perso et Réserves sont réellement inaccessibles au public, puisqu'ils ne
sont jamais copiés dans le site.
