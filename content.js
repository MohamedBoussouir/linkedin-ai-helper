console.log('%c[LinkedIn AI] Multimodal Engine Ready!', 'color: #00d26a; font-weight: bold; font-size: 14px;');

// دالة تحويل رابط الصورة إلى Base64
async function getBase64FromUrl(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve({
          mimeType: blob.type || 'image/jpeg',
          data: base64data
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

// استخراج النص المكتوب في المنشور
function extractPostText(postContainer) {
  if (!postContainer) return '';

  const textElements = postContainer.querySelectorAll(
    '.feed-shared-update-v2__description, .update-components-text, .feed-shared-text, div[dir="ltr"], div[dir="rtl"], span[dir="ltr"]'
  );

  let extracted = '';
  textElements.forEach(el => {
    if (!el.closest('button') && !el.closest('.comments-comment-box') && !el.closest('form')) {
      const txt = el.innerText.trim();
      if (txt && !extracted.includes(txt)) {
        extracted += txt + ' ';
      }
    }
  });

  return extracted.trim() || postContainer.innerText.slice(0, 800);
}

// إنشاء الزر المخصص
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

    // الوصول الدقيق لحاوية المنشور انطلاقاً من الزر
    const commentBtn = btn.parentElement.querySelector('button[aria-label*="comment" i], button[aria-label*="commenter" i]');
    const postContainer = btn.closest('div[role="listitem"]') ||
                          btn.closest('div[data-urn]') ||
                          btn.closest('.feed-shared-update-v2') ||
                          btn.closest('article') ||
                          btn.parentElement.parentElement.parentElement.parentElement;

    const postContext = extractPostText(postContainer);

    // البحث عن الصورة واستخراج Base64
    let postImageData = null;
    if (postContainer) {
      const allImages = Array.from(postContainer.querySelectorAll('img')).filter(img => {
        const src = img.src || '';
        const alt = (img.alt || '').toLowerCase();
        const isAvatar = alt.includes('avatar') || alt.includes('profile') || alt.includes('photo') ||
                         src.includes('profile-displayphoto') || img.width < 100;
        return !isAvatar;
      });

      if (allImages.length > 0) {
        postImageData = await getBase64FromUrl(allImages[0].src);
      }
    }

    // فتح صندوق التعليقات إذا كان مغلقاً
    if (commentBtn) {
      commentBtn.click();
    }

    // إرسال البيانات للـ Service Worker
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
            } else if (attempts > 10) {
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

// حقن الزر بجانب كل زر تعليق
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