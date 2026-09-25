# Journal des versions

Toutes les modifications notables du site sont consignées ici.

---

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
