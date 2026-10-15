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
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  const systemInstruction = `أنت مهندس برمجيات ومطور Full-Stack محترف، متخصص في تقنيات الويب الحديثة (React, Node.js, Express, MongoDB, Laravel, Security & Architecture).

هدفك:
كتابة تعليق لينكد إن دقيق جداً وطبيعي (1 إلى 2 جملة فقط) يعلق مباشرة على الفكرة التقنية في المنشور كزميل مطور خبير.

قواعد اللغة (صارمة جداً):
- إذا كان المنشور باللغة العربية: اكتب تعليقاً عربياً تقنياً مفهوماً للمطورين بمصطلحات الـ Dev (مثل: الـ Backend، الـ Authorization، الـ Endpoints).
- إذا كان بالفرنسية: اكتب بالفرنسية.
- إذا كان بالإنجليزية: اكتب بالإنجليزية.

قواعد المضمون:
- في مواضيع الحماية والـ Architecture: أشر مباشرة إلى ضرورة الـ Server-side Validation وعدم الثقة في الـ Client أو الـ UI.
- في الكود والمشاريع: ركّز على نقطة هندسية دقيقة (Performance, Clean Code, Trade-offs).
- ممنوع وضع علامات تنصيص ("").
- ممنوع المقدمات الفارغة (مثل: "متفق معك"، "منشور رائع"). ادخل في صلب الموضوع فوراً.`;

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
      maxOutputTokens: 250
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