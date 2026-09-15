const state = {
  source: 'screen', stream: null, recorder: null, chunks: [], blob: null,
  fileName: '', duration: 0, projectName: 'Untitled recording', isRecording: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const preview = $('#previewVideo');
const recordButton = $('#recordButton');
const toast = $('#toast');
let timerId;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function setSource(source) {
  state.source = source;
  $$('.source-tab').forEach((button) => {
    const selected = button.dataset.source === source;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  const sourceCopy = {
    screen: ['Current screen', 'Choose a tab, window, or display after pressing record.'],
    camera: ['Camera recording', 'Use the rear or front camera on your device.'],
    upload: ['Import a video', 'Open a recording already saved on this device.'],
  }[source];
  $('#captureOptions .option-row strong').textContent = sourceCopy[0];
  $('#sourceDescription').textContent = sourceCopy[1];
  $('#recordButtonText').textContent = source === 'upload' ? 'Choose a video' : 'Start recording';
}

async function startCapture() {
  if (state.source === 'upload') { $('#fileInput').click(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Recording is not supported by this browser. Try Chrome or Edge.'); return;
  }
  try {
    const wantsMic = $('#microphoneToggle').checked;
    let stream;
    if (state.source === 'screen') {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: $('#systemAudioToggle').checked });
      if (wantsMic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream = new MediaStream([...stream.getVideoTracks(), ...stream.getAudioTracks(), ...mic.getAudioTracks()]);
        } catch { showToast('Screen recording started without microphone access.'); }
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: wantsMic });
    }
    beginRecording(stream);
  } catch (error) {
    if (error.name !== 'NotAllowedError') showToast('Could not start recording. Please check browser permissions.');
  }
}

function beginRecording(stream) {
  state.stream = stream;
  state.chunks = [];
  state.recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined);
  state.recorder.ondataavailable = (event) => { if (event.data.size) state.chunks.push(event.data); };
  state.recorder.onstop = finishRecording;
  stream.getVideoTracks()[0].addEventListener('ended', () => { if (state.isRecording) stopRecording(); });
  state.recorder.start(1000);
  state.isRecording = true;
  recordButton.classList.add('recording');
  $('#recordButtonText').textContent = 'Stop recording';
  $('#recIndicator').hidden = false;
  const startedAt = Date.now();
  timerId = window.setInterval(() => { $('#recordingTime').textContent = formatTime((Date.now() - startedAt) / 1000); }, 250);
}

function stopRecording() {
  if (state.recorder?.state === 'recording') state.recorder.stop();
  state.stream?.getTracks().forEach((track) => track.stop());
}

function finishRecording() {
  window.clearInterval(timerId);
  state.isRecording = false;
  state.blob = new Blob(state.chunks, { type: state.recorder.mimeType || 'video/webm' });
  state.fileName = `recordly-${new Date().toISOString().slice(0, 10)}.webm`;
  setMedia(URL.createObjectURL(state.blob), state.fileName);
  recordButton.classList.remove('recording');
  $('#recordButtonText').textContent = 'Record again';
  $('#recIndicator').hidden = true;
  showToast('Recording added to your editor.');
}

function setMedia(url, fileName) {
  preview.src = url;
  preview.load();
  $('#previewFrame').classList.add('has-media');
  $('#emptyPreview').hidden = true;
  $('#clipName').textContent = fileName.length > 25 ? `${fileName.slice(0, 22)}…` : fileName;
  $('#previewMeta').textContent = fileName;
  $('#editorStatus').classList.add('ready');
  $('#editorStatus').innerHTML = '<span></span> Ready to edit';
  ['#playButton', '#timelinePlay', '#backButton', '#forwardButton', '#scrubber', '#trimStart', '#trimEnd'].forEach((selector) => $(selector).disabled = false);
  $('#exportButton').disabled = false;
  preview.onloadedmetadata = () => {
    state.duration = preview.duration;
    $('#durationLabel').textContent = formatTime(state.duration);
    $('#currentTime').textContent = `00:00 / ${formatTime(state.duration)}`;
    $('#trimEnd').value = Math.floor(state.duration);
    $('#trimEnd').max = Math.floor(state.duration);
    $('#trimStart').max = Math.floor(state.duration);
    $('#scrubber').max = Math.max(1, Math.floor(state.duration * 100));
    saveProject();
  };
}

function togglePlay() {
  if (!preview.src) return;
  if (preview.paused) { preview.play(); } else { preview.pause(); }
}

function syncPlayback() {
  const paused = preview.paused;
  $('#playButton').textContent = paused ? '▶' : 'Ⅱ';
  $('#timelinePlay').innerHTML = paused ? '▶ <span>Play</span>' : 'Ⅱ <span>Pause</span>';
}

function applyFrameStyle() {
  const frame = $('#previewFrame');
  const padding = $('#paddingRange').value;
  const roundness = $('#roundnessRange').value;
  frame.style.padding = `${padding}px`;
  frame.style.borderRadius = `${roundness}px`;
  frame.style.boxShadow = $('#shadowToggle').checked ? '0 24px 46px rgba(0,0,0,.48)' : 'none';
  $('#paddingOutput').textContent = `${padding} px`;
  $('#roundnessOutput').textContent = `${roundness} px`;
}

function saveProject() {
  if (!preview.src) return;
  const projects = JSON.parse(localStorage.getItem('recordly-projects') || '[]');
  const project = { name: state.projectName, media: state.fileName, duration: state.duration, updatedAt: new Date().toLocaleDateString() };
  const withoutCurrent = projects.filter((item) => item.name !== project.name);
  localStorage.setItem('recordly-projects', JSON.stringify([project, ...withoutCurrent].slice(0, 12)));
  renderProjects();
  $('#saveStatus').textContent = 'Saved';
}

function renderProjects() {
  const projects = JSON.parse(localStorage.getItem('recordly-projects') || '[]');
  $('#projectCount').textContent = projects.length;
  $('#projectsList').innerHTML = projects.length ? projects.map((project, index) => `<article class="project-tile"><div class="project-thumb" style="filter:hue-rotate(${index * 37}deg)"></div><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.media)} · ${formatTime(project.duration)}</small><button data-open-project="${index}">Open project →</button></article>`).join('') : '<div class="empty-library">Your completed recordings will be listed here. Projects stay private to this browser.</div>';
  $$('[data-open-project]').forEach((button) => button.addEventListener('click', () => {
    const project = projects[Number(button.dataset.openProject)];
    state.projectName = project.name;
    $('#projectTitle').textContent = project.name;
    location.hash = '#studio';
    showToast('Project details restored. Re-add the source video to continue editing.');
  }));
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

$$('.source-tab').forEach((button) => button.addEventListener('click', () => setSource(button.dataset.source)));
recordButton.addEventListener('click', () => state.isRecording ? stopRecording() : startCapture());
$('#fileInput').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.blob = file; state.fileName = file.name; setMedia(URL.createObjectURL(file), file.name); showToast('Video ready in the editor.');
});
$('#playButton').addEventListener('click', togglePlay); $('#timelinePlay').addEventListener('click', togglePlay);
preview.addEventListener('play', syncPlayback); preview.addEventListener('pause', syncPlayback);
preview.addEventListener('timeupdate', () => {
  const trimEnd = Number($('#trimEnd').value || state.duration);
  if (preview.currentTime >= trimEnd && trimEnd > 0) { preview.pause(); preview.currentTime = Number($('#trimStart').value || 0); }
  $('#scrubber').value = Math.round(preview.currentTime * 100);
  $('#currentTime').textContent = `${formatTime(preview.currentTime)} / ${formatTime(state.duration)}`;
});
$('#scrubber').addEventListener('input', (event) => { preview.currentTime = Number(event.target.value) / 100; });
['#trimStart', '#trimEnd'].forEach((selector) => $(selector).addEventListener('change', () => {
  const start = Number($('#trimStart').value || 0);
  const end = Number($('#trimEnd').value || state.duration);
  if (start >= end) { $('#trimEnd').value = Math.min(Math.floor(state.duration), start + 1); }
  if (preview.currentTime < start || preview.currentTime > end) preview.currentTime = start;
  $('#saveStatus').textContent = 'Saved';
}));
$('#backButton').addEventListener('click', () => { preview.currentTime = Math.max(0, preview.currentTime - 5); });
$('#forwardButton').addEventListener('click', () => { preview.currentTime = Math.min(state.duration, preview.currentTime + 5); });
['#paddingRange', '#roundnessRange', '#shadowToggle'].forEach((selector) => $(selector).addEventListener('input', applyFrameStyle));
$$('.swatch').forEach((button) => button.addEventListener('click', () => { $$('.swatch').forEach((swatch) => swatch.classList.remove('selected')); button.classList.add('selected'); const bg = button.dataset.bg; const styles = { aurora: 'linear-gradient(145deg,#253343,#141c29)', midnight: 'linear-gradient(145deg,#17192e,#3b285d)', coral: 'linear-gradient(145deg,#7b3947,#ba8563)', lime: 'linear-gradient(145deg,#35675f,#a4bc63)', plain: '#272832' }; $('#previewFrame').style.background = styles[bg]; }));
$$('.inspector-tab').forEach((button) => button.addEventListener('click', () => { const tab = button.dataset.inspector; $$('.inspector-tab').forEach((tabButton) => tabButton.classList.toggle('selected', tabButton === button)); ['style', 'cursor', 'webcam'].forEach((name) => $(`#${name}Panel`).classList.toggle('hidden', name !== tab)); }));
$('#webcamButton').addEventListener('click', () => { setSource('camera'); window.scrollTo({ top: 0, behavior: 'smooth' }); showToast('Camera selected. Record a facecam clip to add it later.'); });
$('#renameButton').addEventListener('click', () => { const name = window.prompt('Name this project', state.projectName); if (name?.trim()) { state.projectName = name.trim(); $('#projectTitle').textContent = state.projectName; $('#saveStatus').textContent = 'Saving…'; window.setTimeout(saveProject, 350); } });
$('#exportButton').addEventListener('click', () => { if (state.blob) $('#exportDialog').showModal(); });
$('#downloadButton').addEventListener('click', () => { if (!state.blob) return; const link = document.createElement('a'); link.href = URL.createObjectURL(state.blob); link.download = state.fileName || 'recordly-recording.webm'; link.click(); URL.revokeObjectURL(link.href); $('#exportDialog').close(); showToast('Your recording is downloading.'); });
$('#helpButton').addEventListener('click', () => $('#guideDialog').showModal()); $('#shortcutsButton').addEventListener('click', () => $('#guideDialog').showModal()); $('#mobileHelp').addEventListener('click', () => $('#guideDialog').showModal()); $('#mobileRecord').addEventListener('click', () => { document.querySelector('.capture-card').scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(startCapture, 500); });
$$('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.addEventListener('keydown', (event) => { if (event.target.matches('input')) return; if (event.key.toLowerCase() === 'r') { event.preventDefault(); state.isRecording ? stopRecording() : startCapture(); } if (event.code === 'Space' && preview.src) { event.preventDefault(); togglePlay(); } });
window.addEventListener('hashchange', () => { const showingProjects = location.hash === '#projects'; $('#studio').classList.toggle('hidden', showingProjects); $('#projects').classList.toggle('hidden', !showingProjects); $$('.nav-item, .mobile-nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === (showingProjects ? '#projects' : '#studio'))); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
renderProjects();
