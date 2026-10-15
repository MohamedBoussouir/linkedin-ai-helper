console.log('%c[LinkedIn AI] Multimodal Engine Ready!', 'color: #00d26a; font-weight: bold; font-size: 14px;');

// تحويل الصورة المعروضة مباشرة داخل الصفحة إلى Base64 باستخدام Canvas لتفادي قيود الـ CORS
function getBase64FromImageElement(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 600;
    canvas.height = img.naturalHeight || img.height || 400;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const parts = dataUrl.split(',');
    return {
      mimeType: 'image/jpeg',
      data: parts[1]
    };
  } catch (err) {
    console.warn('[LinkedIn AI] فشل تحويل الصورة عبر Canvas:', err);
    return null;
  }
}

// استخراج النص الكامل للمنشور بعد كشف النص المخفي
// استخراج النص الكامل للمنشور بدقة ودون انقطاع
function extractPostText(postContainer) {
  if (!postContainer) return '';

  // 1. الضغط التلقائي على زر عرض المزيد (...voir plus / see more)
  const seeMoreBtn = postContainer.querySelector(
    'button.feed-shared-inline-show-more-text__see-more-less-toggle, button[aria-label*="voir plus" i], button[aria-label*="see more" i], button.update-components-text__see-more-less-toggle'
  );
  if (seeMoreBtn) {
    seeMoreBtn.click();
  }

  // 2. البحث المباشر عن حاوية نص المنشور الفعلية (بدون اسم الكاتب أو الأزرار)
  const mainTextContainer = postContainer.querySelector(
    '.feed-shared-update-v2__description-wrapper, .update-components-update-v2__commentary, .feed-shared-inline-show-more-text, .update-components-text'
  );

  if (mainTextContainer) {
    const cleanText = mainTextContainer.innerText.replace(/\.\.\.voir plus|\.\.\.see more/gi, '').trim();
    if (cleanText.length > 20) {
      return cleanText.slice(0, 5000); // مساحة كافية جداً لأطول المنشورات
    }
  }

  // 3. طريقة احتياطية شاملة في حال تغيّر اسم الكلاس في لينكد إن
  const textElements = postContainer.querySelectorAll(
    '.feed-shared-update-v2__description, div[dir="ltr"], div[dir="rtl"]'
  );

  let extracted = '';
  textElements.forEach(el => {
    if (!el.closest('button') && !el.closest('.comments-comment-box') && !el.closest('form') && !el.closest('.feed-shared-actor')) {
      const txt = el.innerText.trim();
      if (txt && !extracted.includes(txt)) {
        extracted += txt + '\n';
      }
    }
  });

  return (extracted.trim() || postContainer.innerText).slice(0, 5000);
}

// إنشاء زر التوليد الذكي
function createButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-feed-ai-btn';
  btn.innerText = '✨ AI Comment';
  btn.style.cssText = `
    background: #0a66c2 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 16px !important;
    padding: 6px 14px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    margin-left: 8px !important;
    margin-right: 8px !important;
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
    z-index: 9999 !important;
  `;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.innerText = '⏳ تحليل الصورة والنص...';
    btn.disabled = true;

    // 1. تحديد حاوية المنشور الأساسية
    const commentBtn = btn.parentElement.querySelector('button[aria-label*="comment" i], button[aria-label*="commenter" i]');
    const postContainer = btn.closest('div[role="listitem"]') ||
      btn.closest('div[data-urn]') ||
      btn.closest('.feed-shared-update-v2') ||
      btn.closest('article') ||
      btn.parentElement.parentElement.parentElement.parentElement;

    // 2. استخراج النص الكامل
    const postContext = extractPostText(postContainer);

    // 3. استخراج الصورة وتحويلها لـ Base64
    let postImageData = null;
    if (postContainer) {
      const allImages = Array.from(postContainer.querySelectorAll('img')).filter(img => {
        const src = img.src || '';
        const alt = (img.alt || '').toLowerCase();
        const isAvatar = alt.includes('avatar') || alt.includes('profile') || 
                         src.includes('profile-displayphoto') || img.width < 120;
        return !isAvatar && (src.includes('licdn.com') || src.startsWith('blob:') || src.startsWith('data:'));
      });

      if (allImages.length > 0) {
        // نأخذ الصورة الأولى الأساسية في المنشور ونتأكد من اكتمال تحميلها
        const targetImg = allImages[0];
        targetImg.crossOrigin = 'anonymous';
        postImageData = getBase64FromImageElement(targetImg);
      }
    }

    // 4. طباعة الفحص في الكونسول للتأكد من البيانات
    console.log('%c[DEBUG - Content Script]', 'color: #0a66c2; font-weight: bold; font-size: 13px;');
    console.log('1. النص المستخرج بالكامل:', postContext);
    console.log('2. بيانات الصورة:', postImageData ? `موجودة بنجاح (الحجم: ${postImageData.data.length} حرف)` : 'لا توجد صورة أو فشل الاستخراج (null)');

    // 5. فتح صندوق التعليق
    if (commentBtn) {
      commentBtn.click();
    }

    // 6. إرسال الطلب لـ background.js
    chrome.runtime.sendMessage(
      {
        action: 'GENERATE_LINKEDIN_COMMENT',
        postText: postContext,
        imageData: postImageData
      },
      (res) => {
        if (chrome.runtime.lastError || !res || res.status === 'ERROR') {
          alert('خطأ: ' + (res?.message || chrome.runtime.lastError?.message || 'فشل الاتصال'));
        } else {
          let attempts = 0;
          const timer = setInterval(() => {
            attempts++;
            let editor = postContainer ? postContainer.querySelector('.ql-editor, div[contenteditable="true"]') : null;
            if (!editor) {
              editor = document.querySelector('.ql-editor, div[contenteditable="true"]');
            }

            if (editor) {
              clearInterval(timer);
              editor.focus();
              document.execCommand('selectAll', false, null);
              document.execCommand('insertText', false, res.comment);
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (attempts > 12) {
              clearInterval(timer);
              navigator.clipboard.writeText(res.comment);
              alert('تم نسخ التعليق الذكي للحافظة:\n\n' + res.comment);
            }
          }, 250);
        }
        btn.innerText = '✨ AI Comment';
        btn.disabled = false;
      }
    );
  });

  return btn;
}

// تثبيت الزر بجانب زر التعليق التابع للينكد إن
function scanAndAttach() {
  const commentButtons = document.querySelectorAll(
    'button[aria-label*="comment" i], button[aria-label*="commenter" i]'
  );

  commentButtons.forEach((commentBtn) => {
    if (commentBtn.parentElement && !commentBtn.parentElement.querySelector('.custom-feed-ai-btn')) {
      const btn = createButton();
      commentBtn.parentElement.appendChild(btn);
    }
  });
}

setInterval(scanAndAttach, 800);