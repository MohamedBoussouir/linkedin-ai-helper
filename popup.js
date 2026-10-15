document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['geminiKey'], (data) => {
    if (data.geminiKey) document.getElementById('geminiKey').value = data.geminiKey;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const geminiKey = document.getElementById('geminiKey').value.trim();
    chrome.storage.local.set({ geminiKey }, () => {
      const status = document.getElementById('status');
      status.innerText = 'تم الحفظ بنجاح!';
      setTimeout(() => status.innerText = '', 2000);
    });
  });
});