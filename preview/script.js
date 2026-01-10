let selectedFile = null;
let selectedUnlockMethod = null;

// Navigation
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    // Show target page
    document.getElementById('page-' + pageId).classList.add('active');

    // Update Tab Bar (simple logic)
    if (pageId === 'home') {
        document.querySelector('.tab-bar').style.display = 'flex';
    } else if (pageId === 'result') {
        document.querySelector('.tab-bar').style.display = 'none'; // mimic hiding tabbar on result
    }
}

// Upload Logic
function triggerFileUpload() {
    document.getElementById('file-input').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('upload-preview-img').src = e.target.result;
            document.getElementById('preview-container').style.display = 'flex';
            document.querySelector('.upload-placeholder').style.display = 'none';
            document.getElementById('upload-area').style.border = 'none';

            // Enable button
            const btn = document.getElementById('upload-btn');
            btn.classList.remove('btn-disabled');
            btn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
}

function startValidation() {
    // Show Validating View
    navigateTo('validate');
    const scanImg = document.getElementById('scan-img');
    const reader = new FileReader();
    reader.onload = (e) => { scanImg.src = e.target.result; };
    if (selectedFile) reader.readAsDataURL(selectedFile);

    // Simulate steps
    let step = 1;
    const interval = setInterval(() => {
        if (step > 4) {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('validating-view').style.display = 'none';
                document.getElementById('validation-success-view').style.display = 'block';
            }, 500);
            return;
        }

        // Highlight steps
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`val-step-${i}`);
            if (i === step) el.classList.add('active');
            else if (i < step) {
                el.classList.remove('active');
                el.innerHTML = `<span style="color:var(--success-color)">✓ ${el.innerText}</span>`;
            }
        }
        step++;
    }, 800);
}

// Unlock Logic
function selectUnlockMethod(method) {
    selectedUnlockMethod = method;
    document.querySelectorAll('.unlock-card').forEach(el => el.classList.remove('selected'));
    document.getElementById('unlock-' + method).classList.add('selected');

    const btn = document.getElementById('unlock-btn');
    btn.classList.remove('btn-disabled');
    btn.disabled = false;
    btn.innerText = method === 'ad' ? '观看广告免费解锁' : '立即支付 ¥9.9';
}

function confirmUnlock() {
    if (!selectedUnlockMethod) return;

    if (selectedUnlockMethod === 'ad') {
        alert('（模拟）广告播放广告中... 5秒后自动完成');
        setTimeout(() => {
            startGenerating();
        }, 1500); // speed up for demo
    } else {
        alert('（模拟）支付成功！');
        startGenerating();
    }
}

// Generation Logic
function startGenerating() {
    navigateTo('job');
    let progress = 0;
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');

    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 5) + 1;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(showResult, 500);
        }

        fill.style.width = progress + '%';
        text.innerText = progress + '%';
    }, 100);
}

function showResult() {
    // Generate a random baby image from placeholder service
    const randomId = Math.floor(Math.random() * 100);
    const resultUrl = `https://picsum.photos/id/${randomId}/800/800`;
    document.getElementById('result-img').src = resultUrl;

    navigateTo('result');
}
