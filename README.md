# Voyage en Imaginaire — Laurent GANNE

Galerie personnelle : photographies, graphismes et créations sonores.
HTML + CSS + JavaScript, sans installation ni build.

---

## 1. Deux modes, un seul site

Le même `index.html` se comporte différemment selon l'endroit où il est ouvert.

| | **Mode atelier** (votre Mac) | **Mode public** (en ligne) |
|---|---|---|
| Source des médias | les 5 dossiers du Bureau | `catalogue.json` + `medias/` |
| Onglets visibles | les 5 | Photo, Graphi, Audio |
| Perso et Réserves | accessibles par mot de passe | **absents du site** |
| Export entre onglets | oui | non |
| Navigateur | Chrome ou Edge | tous |

Le passage de l'un à l'autre est automatique : si `catalogue.json` existe, le
site est en mode public ; si vous reliez le dossier du Bureau, vous basculez
en mode atelier.

**Perso et Réserves ne sont pas seulement masqués en ligne : leurs fichiers
ne sont jamais copiés dans le site.** La protection n'est pas un mot de
passe, c'est une absence.

---

## 2. Les deux dossiers du Bureau

| Dossier | Rôle | Sur GitHub ? |
|---|---|---|
| `Voyage-en-Imaginaire/` | votre base privée | **jamais** |
| `site-voyage-imaginaire/` | le site | oui |

```
Bureau/Voyage-en-Imaginaire/          ← la base de données
├── 1-Photo/        → publiable
├── 2-Graphi/        → publiable
├── 3-Audio/         → publiable
├── 4-Perso/         → JAMAIS publié
└── 5-Reserves/      → JAMAIS publié
```

Chaque dossier contient un `legendes.txt` (voir §5).

---

## 3. Remplir la base

### Depuis l'application Photos du Mac

Les images de Photos sont enfermées dans une photothèque : le copier-coller
direct ne fonctionne pas. Il faut exporter.

1. Dans **Photos**, sélectionnez vos images
2. **Fichier → Exporter → Exporter N photos…**
3. **Type de photo : JPEG** (surtout pas « Original »)
4. Destination : `Bureau/Voyage-en-Imaginaire/1-Photo`

> **Pourquoi JPEG ?** Les iPhone enregistrent en **HEIC**, que Chrome ne sait
> pas afficher. Si vous exportez les originaux, l'outil de publication les
> convertira automatiquement — mais en mode atelier elles resteront
> invisibles. Exporter en JPEG évite le problème d'entrée de jeu.

### Autres fichiers

Copier-coller normal depuis le Finder vers `2-Graphi`.
Pour l'audio, regroupez d'abord vos sons puis copiez-les dans `3-Audio`.
Formats sûrs : **MP3**, **WAV**, **M4A**.

---

## 4. Mots de passe

Aucun indice de format n'est affiché à l'écran. En cas d'erreur, le site
répond seulement « Mot de passe incorrect ».

**Entrée du site** : `JJMMAAAA`, la date du jour.
Le 25 septembre 2026 → `25092026`. Les séparateurs sont acceptés.

**Onglets Perso et Réserves** : `JJMMAAAAHH:MM`, date + heure + minutes.
À 14 h 07 → `250920261407`. Les deux-points sont facultatifs.
Tolérance de 3 minutes, réglable par `MINUTE_TOLERANCE` dans `app.js`.

> ### À lire avant de publier
>
> Ces mots de passe sont vérifiés dans le navigateur. Quelqu'un qui sait lire
> le code source peut les contourner, et les fichiers de `medias/` restent
> accessibles par leur adresse directe.
>
> **Ne publiez donc que ce que vous acceptez de rendre réellement public.**
> Le mot de passe d'entrée est un seuil, une mise en condition — pas un
> coffre-fort. Pour une vraie protection, il faudrait un mot de passe côté
> serveur (Cloudflare Access, gratuit, ou Netlify en offre payante).
>
> Perso et Réserves, eux, sont réellement inaccessibles : ils n'existent pas
> dans la version publiée.

---

## 5. Légendes

Chaque dossier contient un `legendes.txt`. Ouvrez-le avec TextEdit :

```
IMG_4821.jpg = Coucher de soleil sur la Loire, juin 2025
ruelle.png   = Ruelle de Lisbonne, un dimanche
```

Les deux écritures `=` et `|` fonctionnent. Les lignes commençant par `#`
sont des notes ignorées.

Pour un fichier absent de la liste, le site fabrique une légende depuis son
nom : `01_les-aravis.jpg` devient *« les aravis »*. Bien nommer ses fichiers
suffit donc souvent. Ce `legendes.txt` n'apparaît jamais dans le diaporama.

---

## 6. Utilisation

En mode atelier, cliquez une fois sur **Relier mon dossier** en bas à gauche
et choisissez `Voyage-en-Imaginaire`. Le site retient le dossier ensuite.

| Action | Comment |
|---|---|
| Suivant / précédent | flèches **→** et **←** |
| Diaporama marche/arrêt | bouton **▶ Diaporama** ou **barre d'espace** |
| Aller à un onglet | touches **1** à **5** |
| Retour à l'accueil | bouton **porte** ou **Échap** |
| Papier peint | ouvrir une image → **Papier peint** |
| Déplacer un fichier | Perso/Réserves → **Exporter vers ▾** |

**Diaporama** : une vue toutes les 8 secondes, en boucle, avec une barre
dorée en haut indiquant le temps restant. En Audio, il attend la fin du
morceau plutôt que de couper la musique. Durée réglable par
`SLIDESHOW_SECONDS` dans `app.js`.

---

## 7. Publier

### À chaque mise à jour

1. **Double-cliquez sur `publier.command`**

   Il lit `1-Photo`, `2-Graphi`, `3-Audio` ; convertit les HEIC en JPEG ;
   réduit les images à 2000 px de côté ; recopie les légendes ; écrit
   `medias/` et `catalogue.json`. Il ne lit jamais `4-Perso` ni
   `5-Reserves`, et vous prévient si un doublon suspect apparaît.

2. **GitHub Desktop** → vérifiez la liste des fichiers → *Commit* → *Push origin*

### La première fois

1. GitHub Desktop → `Add Local Repository` → `site-voyage-imaginaire`
2. *Publish repository* — décochez **Keep this code private** (GitHub Pages
   gratuit exige un dépôt public)
3. Sur github.com : **Settings → Pages** → branche `main`, dossier `/ (root)`
4. Deux minutes plus tard : `https://VOTRE-PSEUDO.github.io/site-voyage-imaginaire/`

> **Contrôle à faire au premier commit.** Dans GitHub Desktop, parcourez la
> liste des fichiers ajoutés. Vous devez y voir `medias/…` mais **jamais**
> `4-Perso` ni `5-Reserves`. Le `.gitignore` est fait pour ça, vérifiez-le
> quand même une fois.

### Prévisualiser le mode public en local

Le double-clic sur `index.html` ouvre toujours le mode atelier : les
navigateurs interdisent la lecture de `catalogue.json` depuis un fichier
local. Pour voir ce que verra le public, utilisez l'extension **Live Server**
de VS Code : clic droit sur `index.html` → *Open with Live Server*.

---

## 8. Personnaliser

**`styles.css`**, bloc `:root` :

```css
--gold:   #d8b26a;   /* couleur d'accent    */
--rail-w: 184px;     /* largeur du menu     */
```

**`app.js`**, bloc `CONFIG` : nom du dossier racine, tolérance du mot de
passe horaire, durée du diaporama.

**Luminosité du fond** : blocs `.gate__veil` (portail) et `.home__veil`
(accueil) dans `styles.css`. Le dernier nombre de chaque ligne est
l'opacité : `0` = image pleine, `1` = noir complet.

**Fond d'écran** : `assets/fond.svg`. Remplacez-le en gardant le même nom.

---

## 9. Formats reconnus

- **Images** : jpg, png, gif, webp, avif, svg, bmp — et heic/tiff, convertis
  automatiquement à la publication
- **Audio** : mp3, wav, m4a, aac, ogg, flac, opus
