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

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ];
  const systemInstruction = `أنت مهندس برمجيات محترف، تكتب تعليقاً مهنياً، واضحاً وموجزاً على لينكد إن.

الهدف:
كتابة تعليق قصير جداً ومباشر (بين 10 إلى 16 كلمة فقط).

قواعد الأسلوب واللغة (صارمة جداً):
- استخدم لغة سليمة، مهنية وواضحة يفهمها الجميع بسهولة (Français courant et professionnel).
- ممنوع منعاً باتاً استخدام العامية الفرنسية أو مصطلحات الشارع (ممنوع: bosser, taf, ouf, mec, truc).
- ممنوع التعقيد الأكاديمي أو التكلف المفرط (ممنوع مصطلحات مثل: exigences non-fonctionnelles).
- جملة واحدة فقط كاملة المعنى ومختومة حتماً بنقطة (.).
- ممنوع وضع علامات تنصيص ("").
- ادخل في الفكرة التقنية فوراً وتجنب المجاملات المكررة (ممنوع: Bravo, Super post).

أمثلة على النبرة المطلوبة:
- بالفرنسية: "L'organisation avec CLAUDE.md et les hooks améliore réellement le workflow de développement."
- بالإنجليزية: "Structuring rules with CLAUDE.md and hooks clearly optimizes the daily development flow."
- بالعربية: "استخدام ملف CLAUDE.md مع الـ hooks يساهم بشكل واضح في تنظيم بيئة العمل وتسريع التطوير."
`;
  const userParts = [
    { text: `Analyse ce post LinkedIn (texte + visuel) et génère le commentaire idéal :\n"""\n${postText || '(Post visuel)'}\n"""` }
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
      maxOutputTokens: 800
    }
  };

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        lastError = data.error?.message || 'خطأ غير معروف';
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  throw new Error(lastError || 'فشل الاتصال بـ Gemini API');
}