const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  stream: null,
  recorder: null,
  chunks: [],
  blob: null,
  fileName: '',
  duration: 0,
  projectName: 'Untitled recording',
  isRecording: false,
  background: 'aurora',
};

const preview = $('#previewVideo');
const toast = $('#toast');
const artboard = $('#artboard');
let timerId;

const backgrounds = ['aurora', 'twilight', 'carbon', 'sunset', 'bloom', 'ocean', 'cloud', 'lime', 'violet', 'ice', 'cobalt', 'peach', 'red', 'moss', 'night', 'paper', 'haze', 'prism'];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function setPanel(panelName) {
  $$('.rail-tool').forEach((button) => button.classList.toggle('active', button.dataset.panel === panelName));
  $$('.tool-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== `${panelName}Panel`));
  if (window.innerWidth < 761) $('#inspector').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setBackground(background) {
  state.background = background;
  artboard.classList.remove(...backgrounds);
  artboard.classList.add(background);
  $$('.bg-thumb').forEach((button) => button.classList.toggle('selected', button.dataset.background === background));
}

function applyFrame() {
  const padding = Number($('#paddingRange').value);
  const radius = Number($('#radiusRange').value);
  const shadow = Number($('#shadowRange').value);
  artboard.style.padding = `${Math.round(8 + padding * 1.05)}px`;
  artboard.style.boxShadow = `0 ${Math.round(14 + shadow / 5)}px ${Math.round(26 + shadow / 2)}px rgba(0, 0, 0, ${0.16 + shadow / 220})`;
  $('#previewSurface').style.borderRadius = `${radius}px`;
  $('#paddingValue').textContent = `${padding}%`;
  $('#radiusValue').textContent = `${radius}%`;
  $('#shadowValue').textContent = `${shadow}%`;
}

function setMedia(url, name) {
  preview.src = url;
  preview.muted = false;
  preview.load();
  $('#previewSurface').classList.add('has-media');
  $('#emptyPreview').classList.add('hidden');
  $('#emptyActions').classList.add('hidden');
  $('#exportButton').disabled = false;
  ['#playButton', '#backButton', '#forwardButton', '#scrubber'].forEach((selector) => { $(selector).disabled = false; });
  $('.layer-label').textContent = `▧  ${name.length > 35 ? `${name.slice(0, 32)}…` : name}`;
  preview.onloadedmetadata = () => {
    state.duration = preview.duration;
    $('#durationLabel').textContent = formatTime(state.duration);
    $('#scrubber').max = Math.max(1, Math.round(state.duration * 100));
    showToast('Media added to your timeline.');
  };
}

async function startCapture() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Screen recording needs a modern Chrome or Edge browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    beginRecording(stream);
  } catch (error) {
    if (error?.name !== 'NotAllowedError') showToast('Unable to start screen recording. Check browser permissions.');
  }
}

function beginRecording(stream) {
  state.stream = stream;
  state.chunks = [];
  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  state.recorder = new MediaRecorder(stream, { mimeType: preferredMime });
  state.recorder.ondataavailable = (event) => { if (event.data.size) state.chunks.push(event.data); };
  state.recorder.onstop = finishRecording;
  stream.getVideoTracks()[0].addEventListener('ended', () => { if (state.isRecording) stopRecording(); });
  state.recorder.start(1000);
  state.isRecording = true;
  $('#recordButton').classList.add('recording');
  $('#recordingPill').classList.remove('hidden');
  const startedAt = Date.now();
  timerId = window.setInterval(() => { $('#recordingTime').textContent = formatTime((Date.now() - startedAt) / 1000); }, 250);
  showToast('Recording started. Select your screen in the browser prompt.');
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
  $('#recordButton').classList.remove('recording');
  $('#recordingPill').classList.add('hidden');
  setMedia(URL.createObjectURL(state.blob), state.fileName);
}

function togglePlay() {
  if (!preview.src) return;
  if (preview.paused) preview.play(); else preview.pause();
}

function syncPlayState() {
  $('#playButton').textContent = preview.paused ? '▶' : 'Ⅱ';
}

function setCaptions(enabled, message = 'Your captions appear here') {
  $('#captionsToggle').checked = enabled;
  $('#captionPreview').textContent = message;
  $('#captionPreview').classList.toggle('hidden', !enabled);
  $('#captionLayer').classList.toggle('hidden', !enabled);
  $('#clearCaptions').disabled = !enabled;
}

function updateRangeOutput(inputId, outputId, suffix) {
  $(`#${outputId}`).textContent = `${$(`#${inputId}`).value}${suffix}`;
}

$$('.rail-tool').forEach((button) => button.addEventListener('click', () => setPanel(button.dataset.panel)));
$$('.bg-thumb').forEach((button) => button.addEventListener('click', () => setBackground(button.dataset.background)));
$$('[data-background-mode]').forEach((button) => button.addEventListener('click', () => {
  $$('[data-background-mode]').forEach((tab) => tab.classList.toggle('selected', tab === button));
  showToast(`${button.textContent} backgrounds selected.`);
}));
['#paddingRange', '#radiusRange', '#shadowRange'].forEach((selector) => $(selector).addEventListener('input', applyFrame));
$('#blurRange').addEventListener('input', () => { $('#blurValue').textContent = `${Number($('#blurRange').value).toFixed(1)}px`; artboard.style.filter = `saturate(1) drop-shadow(0 0 ${Number($('#blurRange').value) / 4}px rgba(121,220,224,.45))`; });
$('#removeBackground').addEventListener('change', (event) => { artboard.style.background = event.target.checked ? '#101012' : ''; showToast(event.target.checked ? 'Canvas background removed.' : 'Canvas background restored.'); });
$('#cropTop').addEventListener('input', () => { $('#previewSurface').style.clipPath = `inset(${$('#cropTop').value}% 0 ${$('#cropBottom').value}% 0)`; });
$('#cropBottom').addEventListener('input', () => { $('#previewSurface').style.clipPath = `inset(${$('#cropTop').value}% 0 ${$('#cropBottom').value}% 0)`; });
$$('[data-reset]').forEach((button) => button.addEventListener('click', () => {
  const target = button.dataset.reset;
  if (target === 'background') { setBackground('aurora'); $('#blurRange').value = 0; $('#blurValue').textContent = '0.0px'; artboard.style.filter = ''; }
  if (target === 'frame') { $('#paddingRange').value = 20; $('#radiusRange').value = 0; $('#shadowRange').value = 67; applyFrame(); }
  if (target === 'captions') setCaptions(false);
  showToast(`${target[0].toUpperCase()}${target.slice(1)} reset.`);
}));

$('#openButton').addEventListener('click', () => $('#fileInput').click());
$('#uploadButton').addEventListener('click', () => $('#fileInput').click());
$('#importButton').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.blob = file;
  state.fileName = file.name;
  setMedia(URL.createObjectURL(file), file.name);
});
$('#recordButton').addEventListener('click', () => state.isRecording ? stopRecording() : startCapture());
$('#captureButton').addEventListener('click', startCapture);
$('#webcamButton').addEventListener('click', () => showToast('Camera recording is ready for the Android native layer.'));
$('#addLayerButton').addEventListener('click', () => showToast('Choose Background, Captions, or Webcam to add a layer.'));
$('#undoButton').addEventListener('click', () => showToast('No edits to undo yet.'));
$('#advancedButton').addEventListener('click', () => showToast('Individual padding controls are planned for the next editor pass.'));

$('#playButton').addEventListener('click', togglePlay);
$('#backButton').addEventListener('click', () => { preview.currentTime = Math.max(0, preview.currentTime - 5); });
$('#forwardButton').addEventListener('click', () => { preview.currentTime = Math.min(state.duration, preview.currentTime + 5); });
preview.addEventListener('play', syncPlayState);
preview.addEventListener('pause', syncPlayState);
preview.addEventListener('timeupdate', () => {
  $('#currentTime').textContent = formatTime(preview.currentTime);
  $('#scrubber').value = Math.round(preview.currentTime * 100);
});
$('#scrubber').addEventListener('input', (event) => { preview.currentTime = Number(event.target.value) / 100; });
$('.volume input').addEventListener('input', (event) => { preview.volume = Number(event.target.value) / 100; });

$('#captionsToggle').addEventListener('change', (event) => setCaptions(event.target.checked));
$('#generateCaptions').addEventListener('click', () => { const language = $('#languageSelect').value; setCaptions(true, language === 'English' ? 'Make every moment easy to follow.' : `Captions generated in ${language}`); showToast('Caption layer added to the timeline.'); });
$('#clearCaptions').addEventListener('click', () => { setCaptions(false); showToast('Captions cleared.'); });
$('#downloadModel').addEventListener('click', () => showToast('Speech model download will be part of the native app.'));
$('#modelButton').addEventListener('click', () => showToast('On-device speech model: English base.'));
$('#captionColor').addEventListener('input', (event) => { $('#captionPreview').style.color = event.target.value; });
$('#captionSize').addEventListener('input', () => { updateRangeOutput('captionSize', 'captionSizeValue', 'px'); $('#captionPreview').style.fontSize = `${$('#captionSize').value}px`; });
$('#captionRows').addEventListener('input', () => updateRangeOutput('captionRows', 'captionRowsValue', ''));
$('#cursorSize').addEventListener('input', () => updateRangeOutput('cursorSize', 'cursorSizeValue', '%'));
$('#smoothingRange').addEventListener('input', () => updateRangeOutput('smoothingRange', 'smoothingValue', '%'));
$('#ratioSelect').addEventListener('change', (event) => { artboard.style.aspectRatio = event.target.value; $('#aspectButton').childNodes[0].textContent = event.target.options[event.target.selectedIndex].text.slice(0, 3); });
$('#aspectButton').addEventListener('click', () => { const options = ['16 / 9', '9 / 16', '1 / 1']; const next = options[(options.indexOf($('#ratioSelect').value) + 1) % options.length]; $('#ratioSelect').value = next; artboard.style.aspectRatio = next; $('#aspectButton').childNodes[0].textContent = `${next.replace(' / ', ':')} `; });
$('#cropButton').addEventListener('click', () => { setPanel('background'); $('#inspector').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); showToast('Crop controls opened.'); });

$('#renameButton').addEventListener('click', () => { const nextName = window.prompt('Name this project', state.projectName); if (nextName?.trim()) { state.projectName = nextName.trim(); $('#projectTitle').textContent = state.projectName; showToast('Project renamed.'); } });
$('#exportButton').addEventListener('click', () => { if (state.blob) $('#exportDialog').showModal(); });
$('#downloadButton').addEventListener('click', () => { if (!state.blob) return; const link = document.createElement('a'); link.href = URL.createObjectURL(state.blob); link.download = state.fileName || 'recordly-recording.webm'; link.click(); URL.revokeObjectURL(link.href); $('#exportDialog').close(); showToast('Your WebM is downloading.'); });
$('#presetsButton').addEventListener('click', () => $('#presetsDialog').showModal());
$$('[data-preset]').forEach((button) => button.addEventListener('click', () => { setBackground(button.dataset.preset); $('#presetsDialog').close(); showToast('Preset applied.'); }));
$$('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, select')) return;
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); state.isRecording ? stopRecording() : startCapture(); }
  if (event.code === 'Space' && preview.src) { event.preventDefault(); togglePlay(); }
});

applyFrame();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
