/* ============================================================================
   RÉGLAGES DE LA RUBRIQUE « SOUVENIRS » — c'est le seul fichier à modifier
   ========================================================================== */
window.SOUVENIRS_CONFIG = {

  // Adresse du NOUVEAU script d'envoi (celui de Code.gs, après déploiement).
  // Tant qu'elle est vide, le bouton « Déposer mes photos » ouvre l'ancien formulaire (ci-dessous).
  PHOTOS_ENDPOINT: "",

  // Ancien formulaire (conservé en secours).
  LEGACY_FORM_URL: "https://script.google.com/macros/s/AKfycbxEStrasQHw445A9FM4XHJJfkA3N4Trd06Owk91qSpOPOxb6KfwoAD-XXqZoxCtGqpxkg/exec",

  // Vidéos : laissez false tant que la solution n'est pas validée et testée.
  VIDEOS_OUVERTES: false,
  VIDEOS_MESSAGE: "Le dépôt de vidéos ouvrira prochainement. Merci de garder précieusement vos plus beaux films !",

  // Galerie « Revivez notre mariage » : passez à true après le mariage, puis listez les médias choisis.
  GALERIE_ACTIVE: false,
  GALERIE: [
    // { type: "photo", src: "galerie/photo-01.jpg", alt: "La première danse" },
    // { type: "video", src: "galerie/video-01.mp4", alt: "L'entrée dans la salle" }
  ]
};
