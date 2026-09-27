#!/bin/bash
# =============================================================================
#  VOYAGE EN IMAGINAIRE — préparation de la version publique
#
#  Double-cliquez sur ce fichier. Il lit vos trois dossiers publics sur le
#  Bureau, en fabrique des copies allégées pour le web dans « medias/ »,
#  puis écrit « catalogue.json », que le site en ligne lit au démarrage.
#
#  Les dossiers 4-Perso et 5-Reserves ne sont JAMAIS lus par ce script.
# =============================================================================

cd "$(dirname "$0")" || exit 1

SRC="$HOME/Desktop/Voyage-en-Imaginaire"
DEST="medias"
MAXPX=2000          # côté le plus long des images publiées, en pixels
QUALITE=88          # qualité JPEG (1-100)
CAPTIONS="legendes.txt"

fin() {
  echo
  read -n 1 -s -r -p "Appuyez sur une touche pour fermer cette fenêtre."
  echo
  exit "${1:-0}"
}

# --- Garde-fous --------------------------------------------------------------

if [ ! -f "index.html" ]; then
  echo "❌  Ce script doit rester dans le dossier du site, à côté de index.html."
  fin 1
fi

if [ ! -d "$SRC" ]; then
  echo "❌  Dossier introuvable : $SRC"
  echo "    Vérifiez qu'il est bien sur le Bureau, avec ce nom exact."
  fin 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "   VOYAGE EN IMAGINAIRE — préparation de la publication"
echo "═══════════════════════════════════════════════════════════"
echo
echo "   Source  : $SRC"
echo "   Publie  : 1-Photo · 2-Graphi · 3-Audio"
echo "   Ignore  : 4-Perso · 5-Reserves   (restent privés)"
echo

# --- Remise à zéro -----------------------------------------------------------

rm -rf "$DEST"
mkdir -p "$DEST/photo" "$DEST/graphi" "$DEST/audio"

# --- Outils ------------------------------------------------------------------

# Échappe une chaîne pour l'insérer dans du JSON.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\n\r\t'
}

# Légende d'un fichier, lue dans le legendes.txt de son dossier source.
# Accepte les deux écritures :  nom.jpg = légende   et   nom.jpg | légende
lire_legende() {
  local dossier="$1" fichier="$2" ligne cle val sep
  [ -f "$dossier/$CAPTIONS" ] || return 0

  while IFS= read -r ligne || [ -n "$ligne" ]; do
    case "$ligne" in \#*|"") continue ;; esac

    case "$ligne" in
      *=*) sep="=" ;;
      *\|*) sep="|" ;;
      *) continue ;;
    esac

    cle="${ligne%%"$sep"*}"
    val="${ligne#*"$sep"}"
    cle="$(printf '%s' "$cle" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    if [ "$(printf '%s' "$cle" | tr '[:upper:]' '[:lower:]')" = \
         "$(printf '%s' "$fichier" | tr '[:upper:]' '[:lower:]')" ]; then
      printf '%s' "$val"
      return 0
    fi
  done < "$dossier/$CAPTIONS"
}

TOTAL=0
CONVERTIS=0
ENTREES=""

# --- Traitement d'une catégorie ---------------------------------------------
# Usage : traiter <dossier_source> <sous_dossier_dest> <image|audio>

traiter() {
  local dossier="$SRC/$1" sortie="$DEST/$2" categorie="$2" type="$3"
  local n=0 entree base ext extlow cible legende

  echo "───────────────────────────────────────────────"
  echo "  $1"

  ENTREES=""

  if [ ! -d "$dossier" ]; then
    echo "  (dossier absent, ignoré)"
    return
  fi

  for entree in "$dossier"/*; do
    [ -f "$entree" ] || continue
    base="$(basename "$entree")"

    # Fichiers techniques écartés
    case "$base" in .*|"$CAPTIONS"|Icon*|*.DS_Store) continue ;; esac

    ext="${base##*.}"
    extlow="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
    cible=""

    if [ "$type" = "image" ]; then
      case "$extlow" in
        heic|heif|tif|tiff)
          # Formats que Chrome ne sait pas afficher : conversion en JPEG
          cible="${base%.*}.jpg"
          if sips -s format jpeg -s formatOptions "$QUALITE" -Z "$MAXPX" \
                  "$entree" --out "$sortie/$cible" >/dev/null 2>&1; then
            echo "  ↻ $base → $cible"
            CONVERTIS=$((CONVERTIS + 1))
          else
            echo "  ✗ $base — conversion impossible, ignoré"
            continue
          fi
          ;;
        jpg|jpeg)
          cible="$base"
          cp "$entree" "$sortie/$cible" 2>/dev/null || continue
          sips -Z "$MAXPX" "$sortie/$cible" >/dev/null 2>&1
          echo "  ✓ $base"
          ;;
        png)
          # Un PNG est bien plus lourd qu'un JPEG à qualité visuelle égale.
          # On le convertit — SAUF s'il contient de la transparence, qui
          # deviendrait un fond noir en JPEG.
          if [ "$(sips -g hasAlpha "$entree" 2>/dev/null | awk '/hasAlpha/{print $2}')" = "yes" ]; then
            cible="$base"
            cp "$entree" "$sortie/$cible" 2>/dev/null || continue
            sips -Z "$MAXPX" "$sortie/$cible" >/dev/null 2>&1
            echo "  ✓ $base — PNG conservé (transparence)"
          else
            cible="${base%.*}.jpg"
            if sips -s format jpeg -s formatOptions "$QUALITE" -Z "$MAXPX" \
                    "$entree" --out "$sortie/$cible" >/dev/null 2>&1; then
              avant=$(( $(stat -f%z "$entree" 2>/dev/null || echo 0) / 1024 ))
              apres=$(( $(stat -f%z "$sortie/$cible" 2>/dev/null || echo 0) / 1024 ))
              echo "  ↻ $base → $cible   (${avant} Ko → ${apres} Ko)"
              CONVERTIS=$((CONVERTIS + 1))
            else
              echo "  ✗ $base — conversion impossible, ignoré"
              continue
            fi
          fi
          ;;
        gif|webp|svg|avif|bmp)
          # Copiés tels quels : retoucher un GIF animé le casserait
          cible="$base"
          cp "$entree" "$sortie/$cible" 2>/dev/null || continue
          echo "  ✓ $base"
          ;;
        *)
          echo "  – $base — format ignoré"
          continue
          ;;
      esac
    else
      case "$extlow" in
        mp3|m4a|wav|aac|ogg|oga|flac|opus)
          cible="$base"
          cp "$entree" "$sortie/$cible" 2>/dev/null || continue
          echo "  ♪ $base"
          ;;
        *)
          echo "  – $base — format audio ignoré"
          continue
          ;;
      esac
    fi

    legende="$(lire_legende "$dossier" "$base")"

    ENTREES="$ENTREES      {
        \"nom\": \"$(json_escape "$cible")\",
        \"fichier\": \"$DEST/$categorie/$(json_escape "$cible")\",
        \"legende\": \"$(json_escape "$legende")\"
      },
"
    n=$((n + 1))
    TOTAL=$((TOTAL + 1))
  done

  echo "  → $n fichier(s) publié(s)"
}

traiter "1-Photo"  "photo"  "image"; LISTE_PHOTO="$ENTREES"
traiter "2-Graphi" "graphi" "image"; LISTE_GRAPHI="$ENTREES"
traiter "3-Audio"  "audio"  "audio"; LISTE_AUDIO="$ENTREES"

# --- Écriture du catalogue ---------------------------------------------------

sans_virgule_finale() {
  printf '%s' "$1" | sed -e '$ s/,[[:space:]]*$//'
}

{
  echo "{"
  echo "  \"_note\": \"Fichier généré par publier.command — ne pas modifier à la main.\","
  echo "  \"genere\": \"$(date '+%d/%m/%Y %H:%M')\","
  echo "  \"onglets\": {"
  echo "    \"photo\": ["
  sans_virgule_finale "$LISTE_PHOTO"
  echo "    ],"
  echo "    \"graphi\": ["
  sans_virgule_finale "$LISTE_GRAPHI"
  echo "    ],"
  echo "    \"audio\": ["
  sans_virgule_finale "$LISTE_AUDIO"
  echo "    ]"
  echo "  }"
  echo "}"
} > "catalogue.json"

# --- Contrôle de sécurité ----------------------------------------------------

FUITE=0
for interdit in "4-Perso" "5-Reserves"; do
  [ -d "$SRC/$interdit" ] || continue
  for f in "$SRC/$interdit"/*; do
    [ -f "$f" ] || continue
    nom="$(basename "$f")"
    [ "$nom" = "$CAPTIONS" ] && continue
    if find "$DEST" -name "$nom" -print -quit 2>/dev/null | grep -q .; then
      echo
      echo "  ⚠️  ATTENTION : « $nom » existe aussi dans $interdit."
      echo "      Vérifiez qu'il s'agit bien d'un fichier destiné au public."
      FUITE=1
    fi
  done
done

POIDS="$(du -sh "$DEST" 2>/dev/null | cut -f1)"

echo
echo "═══════════════════════════════════════════════════════════"
echo "   TERMINÉ"
echo "═══════════════════════════════════════════════════════════"
echo
echo "   $TOTAL fichier(s) prêt(s) pour la publication"
[ "$CONVERTIS" -gt 0 ] && echo "   $CONVERTIS image(s) converties en JPEG (HEIC, TIFF ou PNG)"
echo "   Poids du dossier medias/ : ${POIDS:-0}"
[ "$FUITE" -eq 0 ] && echo "   Contrôle : aucun fichier privé détecté ✓"
echo
echo "   Étape suivante : GitHub Desktop → Commit → Push origin"
echo
fin 0
