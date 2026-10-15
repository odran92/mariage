/* ============================================================================
   LISTE DES HÉBERGEMENTS — facile à mettre à jour
   ----------------------------------------------------------------------------
   Pour ajouter un hébergement : copiez un bloc { ... } ci-dessous, collez-le
   à la suite (sans oublier la virgule) et modifiez les informations.

   Champs :
     id           identifiant unique, sans espace ni accent (ex. "mon-hotel")
     nom          nom de l'établissement
     type         "hotel"  ou  "chambres"   (sert aux filtres)
     categorie    texte affiché sur la fiche (ex. "Hôtel", "Chambres d'hôtes")
     budget       true si c'est un hébergement économique, sinon false
     adresse      numéro et rue
     codePostal   code postal
     ville        ville
     reservation  lien de la page officielle de l'établissement
                  (ou null s'il n'y en a pas : le bouton « Réserver » est alors masqué)
     lat, lng     OPTIONNEL : position exacte. Si absents, la position est
                  calculée automatiquement à partir de l'adresse grâce à la
                  Base Adresse Nationale (api-adresse.data.gouv.fr, service
                  public gratuit, sans clé).
     photo        OPTIONNEL : nom d'un fichier image (ex. "hotel.jpg") à mettre
                  dans le même dossier. N'utilisez que des photos dont vous
                  avez les droits.

   Aucun tarif ni aucune disponibilité n'est affiché : ils changent trop
   souvent. Les invités les consultent sur le site de l'établissement.
   ========================================================================== */

window.DOMAINE = {
  nom: "Domaine de la Fontaine",
  adresse: "1379 rue de la Reine Blanche",
  codePostal: "45160",
  ville: "Olivet"
};

window.HEBERGEMENTS = [
  {
    id: "moulin-saint-julien",
    nom: "Le Moulin Saint-Julien",
    type: "chambres",
    categorie: "Chambres d'hôtes",
    budget: false,
    adresse: "1303 rue de la Reine Blanche",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "https://www.moulinstjulien.com",
    // Position du moulin relevée dans la base publique des repères de crues (data.gouv.fr)
    lat: 47.8706713,
    lng: 1.8826509
  },
  {
    id: "pavillon-bleu",
    nom: "Logis Hôtel Le Pavillon Bleu",
    type: "hotel",
    categorie: "Hôtel",
    budget: false,
    adresse: "351 rue de la Reine Blanche",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "http://www.logishotels.com/fr/hotel/-9817"
  },
  {
    id: "le-rivage",
    nom: "Hôtel Le Rivage",
    type: "hotel",
    categorie: "Hôtel",
    budget: false,
    adresse: "635 rue de la Reine Blanche",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "http://www.lerivage-olivet.com"
  },
  {
    id: "les-mulotieres",
    nom: "Les Mulotières",
    type: "chambres",
    categorie: "Maison d'hôtes",
    budget: false,
    adresse: "902 rue des Cireries",
    codePostal: "45160",
    ville: "Olivet",
    reservation: null
  },
  {
    id: "chateau-du-rondon",
    nom: "Château du Rondon",
    type: "chambres",
    categorie: "Chambres d'hôtes",
    budget: false,
    adresse: "3232 rue du Général de Gaulle",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "https://www.gites-de-france.com/en/centre-val-de-loire/loiret/chateau-du-rondon-h45h024794"
  },
  {
    id: "villa-marjane",
    nom: "Hôtel Villa Marjane",
    type: "hotel",
    categorie: "Hôtel",
    budget: false,
    adresse: "121 route de Sandillon",
    codePostal: "45650",
    ville: "Saint-Jean-le-Blanc",
    reservation: null
  },
  {
    id: "comfort-olivet-provinces",
    nom: "Comfort Hôtel Orléans Olivet Provinces",
    type: "hotel",
    categorie: "Hôtel",
    budget: false,
    adresse: "130 rue du Languedoc",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "https://www.choicehotels.com/france/olivet/comfort-inn-hotels/fr515"
  },
  {
    id: "kyriad-direct-la-source",
    nom: "Kyriad Direct Orléans – Olivet – La Source",
    type: "hotel",
    categorie: "Hôtel économique",
    budget: true,
    adresse: "100 rue du Languedoc",
    codePostal: "45160",
    ville: "Olivet",
    reservation: "https://direct-orleans-olivet.kyriad.com/"
  }
];
