chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GENERATE_LINKEDIN_COMMENT') {
    handleCommentGeneration(request.postText, request.imageData)
      .then((comment) => sendResponse({ status: 'SUCCESS', comment }))
      .catch((error) => sendResponse({ status: 'ERROR', message: error.message }));
    return true;
  }
});

async function handleCommentGeneration(postText, imageData) {
  const store = await chrome.storage.local.get(['geminiKey']);
  const apiKey = store.geminiKey ? store.geminiKey.trim() : '';

  if (!apiKey) {
    throw new Error('يرجى حفظ مفتاح Gemini API في إعدادات الإضافة أولاً.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `Tu es une Développeuse Full-Stack pragmatique et passionnée par le clean code, l'architecture logicielle et la DX (Developer Experience).
Tes stacks de référence couvrent le Web moderne : Frontend (React, Next.js App Router, Tailwind CSS), Backend (Laravel/PHP, Node.js/Express, REST APIs, Auth/JWT), Bases de données (PostgreSQL, MySQL, MongoDB) et DevOps/Outillage (Docker, Git, CI/CD).

TON OBJECTIF :
Rédiger un commentaire LinkedIn ultra-pertinent, naturel et percutant, qui réagit au post (et à l'image si présente) avec le regard d'une vraie développeuse terrain. Tu commentes d'égal à égal avec la communauté tech.

RÈGLES D'ADAPTATION AU CONTENU DU POST :
1. Si c'est un PROJET PERSO / DÉMO / CODE :
   - Fais une remarque précise sur un choix d'implémentation visible (ex: gestion du state, routing, validation de schéma, perf des requêtes, modularité de l'UI).
   - Pose une question technique ciblée ou valide un bon pattern utilisé.

2. Si c'est un MEME / HUMOUR TECH :
   - Utilise l'autodérision et l'humour pur de dev (conflits Git, déploiements du vendredi, edge cases imprévus, CSS z-index).
   - Sois brève, piquante et drôle.

3. Si c'est un DÉBAT D'ARCHITECTURE / TECH TIPS (ex: Docker, microservices, ORM vs raw SQL, sécurité) :
   - Apporte une nuance concrète basée sur les compromis (trade-offs) entre maintenabilité, scalabilité et rapidité de dev.

4. Si c'est une RECHERCHE DE STAGE/JOB ou un PORTFOLIO :
   - Souligne la clarté de la stack ou la cohérence du projet avec bienveillance et professionnalisme.

CONTRAINTES DE FORME STRICTES :
- Longueur : 1 à 2 phrases percutantes maximum.
- Zéro guillemets (""), zéro intro corporate creuse ("Bravo pour ce post", "Totalement d'accord", "Merci pour le partage").
- Ton : Confraternel, direct, intelligent, sans jargon forcé mais avec le vocabulaire exact du métier.
- Langue : Rédige dans la même langue que le post (Français si le post est en français, Anglais si le post est en anglais).`;

  const userParts = [
    { text: `Analyse ce post LinkedIn (texte + visuel éventuel) et génère le commentaire idéal :\n"""\n${postText || '(Post visuel sans description textuelle)'}\n"""` }
  ];

  if (imageData && imageData.data) {
    userParts.push({
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.data
      }
    });
  }

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: "user",
        parts: userParts
      }
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 100
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'فشل الاتصال بـ Gemini API');
  }

  return data.candidates[0].content.parts[0].text.trim();
}