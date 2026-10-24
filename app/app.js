const COLORS = ["#1c1915", "#f7f4ee", "#9c2f2f", "#c4922a", "#2f5d50", "#2c4c7c"];
const MAX_EDGE = 2000;

const gridView = document.querySelector("#grid-view");
const studioView = document.querySelector("#studio-view");
const grid = document.querySelector("#grid");
const heading = document.querySelector("#heading");
const lede = document.querySelector("#lede");
const archiveBack = document.querySelector("#archive-back");
const count = document.querySelector("#count");
const notice = document.querySelector("#notice");
const backButton = document.querySelector("#back");
const hideButton = document.querySelector("#hide");
const downloadButton = document.querySelector("#download");
const discardButton = document.querySelector("#discard");
const eraserButton = document.querySelector("#eraser");
const sizeInput = document.querySelector("#size");
const colorGroup = document.querySelector("#colors");
const metaName = document.querySelector("#meta-name");
const metaInstitution = document.querySelector("#meta-institution");
const metaLicense = document.querySelector("#meta-license");
const loading = document.querySelector("#loading");
const stage = document.querySelector("#stage");
const base = document.querySelector("#base");
const draw = document.querySelector("#draw");
const baseCtx = base.getContext("2d");
const drawCtx = draw.getContext("2d");

const COLLECTIONS = [
  {
    slug: "escola-de-artes-visuais-do-parque-lage",
    name: "Escola de Artes Visuais do Parque Lage",
    description: "Posters, clippings, and photographs of Black arts and culture.",
  },
  {
    slug: "instituto-moreira-salles",
    name: "Instituto Moreira Salles",
    description: "Historic photographs of Brazil, mostly by Marc Ferrez.",
  },
  {
    slug: "museu-de-arte-contemporanea-da-universidade-de-sao-paulo",
    name: "Museu de Arte Contemporânea da Universidade de São Paulo",
    description: "Paintings and drawings from the museum collection.",
  },
  {
    slug: "museu-historico-nacional-ibram",
    name: "Museu Histórico Nacional/Ibram",
    description: "Paintings, empire portraits, Rio landscapes, and coins.",
  },
  {
    slug: "museu-paulista-da-usp",
    name: "Museu Paulista da USP",
    description: "São Paulo postcards and photographs by Gaensly and Haberkorn.",
  },
];

const catalog = Array.isArray(window.CATALOG) ? window.CATALOG : null;
const byId = new Map(catalog ? catalog.map((item) => [item.id, item]) : []);
const bySlug = new Map();
if (catalog) {
  catalog.forEach((item) => {
    const slug = item.id.split("/")[0];
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(item);
  });
}
const collections = COLLECTIONS.filter((collection) => bySlug.has(collection.slug));
const collectionBySlug = new Map(collections.map((collection) => [collection.slug, collection]));

const session = {
  item: null,
  hidden: false,
  eraser: false,
  color: COLORS[0],
  size: Number(sizeInput.value),
  drawing: false,
  hasInk: false,
  pushed: false,
  imageReady: false,
};

let activePointer = null;
let institutionFocus = null;
let pictureFocus = null;
const screen = { name: "institutions", pushed: false };

function assetUrl(path) {
  return path
    .split("/")
    .map((part) => (part === ".." ? part : encodeURIComponent(part)))
    .join("/");
}

function showNotice(message) {
  notice.hidden = false;
  notice.textContent = message;
  gridView.hidden = true;
  studioView.hidden = true;
}

function countLabel(amount, singular, plural) {
  return amount === 1 ? `1 ${singular}` : `${amount} ${plural}`;
}

function thumbImage(item) {
  const image = document.createElement("img");
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  const thumb = assetUrl(item.thumb);
  const full = assetUrl(item.src);
  image.src = thumb;
  image.addEventListener("error", () => {
    if (image.getAttribute("src") !== full) image.src = full;
  });
  return image;
}

function focusButton(key) {
  if (!key) return;
  const button = [...grid.querySelectorAll("[data-key]")].find((item) => item.dataset.key === key);
  if (button) button.focus();
}

function showInstitutions() {
  session.item = null;
  session.drawing = false;
  session.imageReady = false;
  clearOverlay();
  screen.name = "institutions";
  heading.textContent = "Archive";
  lede.textContent = "Choose an institution.";
  count.textContent = countLabel(collections.length, "institution", "institutions");
  archiveBack.hidden = true;
  grid.classList.add("institutions");
  document.title = "Mudarte";
  const fragment = document.createDocumentFragment();
  collections.forEach((collection) => {
    const pictures = bySlug.get(collection.slug);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.key = `institution:${collection.slug}`;
    button.setAttribute("aria-label", `${collection.name}. ${collection.description}`);
    const name = document.createElement("strong");
    name.textContent = collection.name;
    const description = document.createElement("span");
    description.textContent = collection.description;
    button.append(thumbImage(pictures[0]), name, description);
    button.addEventListener("click", () => {
      institutionFocus = collection.slug;
      openCollection(collection.slug);
    });
    fragment.append(button);
  });
  grid.replaceChildren(fragment);
  studioView.hidden = true;
  gridView.hidden = false;
  focusButton(institutionFocus ? `institution:${institutionFocus}` : "");
  institutionFocus = null;
}

function showCollection(slug) {
  const collection = collectionBySlug.get(slug);
  const pictures = bySlug.get(slug);
  if (!collection || !pictures) {
    showInstitutions();
    return;
  }
  session.item = null;
  session.drawing = false;
  session.imageReady = false;
  clearOverlay();
  screen.name = "collection";
  heading.textContent = collection.name;
  lede.textContent = collection.description;
  count.textContent = countLabel(pictures.length, "picture", "pictures");
  archiveBack.hidden = false;
  grid.classList.remove("institutions");
  document.title = `${collection.name} — Mudarte`;
  const fragment = document.createDocumentFragment();
  pictures.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.key = `picture:${item.id}`;
    button.setAttribute("aria-label", item.filename);
    button.append(thumbImage(item));
    button.addEventListener("click", () => openPicture(item));
    fragment.append(button);
  });
  grid.replaceChildren(fragment);
  studioView.hidden = true;
  gridView.hidden = false;
  if (pictureFocus && pictureFocus.startsWith(`${slug}/`)) {
    focusButton(`picture:${pictureFocus}`);
    pictureFocus = null;
  }
}

function showStudio(item) {
  session.item = item;
  session.hidden = false;
  session.eraser = false;
  session.hasInk = false;
  session.drawing = false;
  session.imageReady = false;
  setHidden(false);
  setEraser(false);
  selectColor(session.color);
  downloadButton.disabled = true;
  metaName.textContent = item.filename;
  metaInstitution.textContent = item.institution;
  metaLicense.textContent = item.license;
  document.title = `${item.filename} — Mudarte`;
  gridView.hidden = true;
  studioView.hidden = false;
  clearOverlay();
  loadImage(item);
  backButton.focus();
}

function loadImage(item) {
  loading.textContent = "Loading picture…";
  loading.hidden = false;
  const image = new Image();
  image.onload = () => {
    if (session.item !== item) return;
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    base.width = width;
    base.height = height;
    draw.width = width;
    draw.height = height;
    baseCtx.clearRect(0, 0, width, height);
    baseCtx.drawImage(image, 0, 0, width, height);
    drawCtx.clearRect(0, 0, width, height);
    applyDisplaySize();
    session.imageReady = true;
    downloadButton.disabled = false;
    loading.hidden = true;
  };
  image.onerror = () => {
    if (session.item !== item) return;
    loading.textContent = "This picture could not be loaded.";
    loading.hidden = false;
  };
  image.src = assetUrl(item.src);
}

function applyDisplaySize() {
  if (studioView.hidden || !base.width || !base.height) return;
  const maxWidth = Math.max(1, stage.clientWidth - 32);
  const maxHeight = Math.max(1, stage.clientHeight - 32);
  const scale = Math.min(maxWidth / base.width, maxHeight / base.height);
  const width = `${Math.max(1, Math.round(base.width * scale))}px`;
  const height = `${Math.max(1, Math.round(base.height * scale))}px`;
  base.style.width = width;
  base.style.height = height;
  draw.style.width = width;
  draw.style.height = height;
}

function clearOverlay() {
  drawCtx.clearRect(0, 0, draw.width, draw.height);
  session.hasInk = false;
  session.drawing = false;
  activePointer = null;
}

function setHidden(hidden) {
  session.hidden = hidden;
  if (hidden) session.drawing = false;
  draw.classList.toggle("is-hidden", hidden);
  hideButton.textContent = hidden ? "Show remix" : "Hide remix";
  hideButton.setAttribute("aria-pressed", String(hidden));
}

function setEraser(on) {
  session.eraser = on;
  eraserButton.setAttribute("aria-pressed", String(on));
}

function selectColor(color) {
  session.color = color;
  session.eraser = false;
  setEraser(false);
  colorGroup.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  });
}

function canvasPoint(event) {
  const rect = draw.getBoundingClientRect();
  const scaleX = rect.width ? draw.width / rect.width : 1;
  const scaleY = rect.height ? draw.height / rect.height : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function brushWidth() {
  const rect = draw.getBoundingClientRect();
  const scale = rect.width ? draw.width / rect.width : 1;
  return session.size * scale;
}

function stamp(point) {
  const radius = brushWidth() / 2;
  drawCtx.save();
  drawCtx.globalCompositeOperation = session.eraser ? "destination-out" : "source-over";
  drawCtx.fillStyle = session.eraser ? "rgba(0,0,0,1)" : session.color;
  drawCtx.beginPath();
  drawCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
  session.hasInk = true;
}

function stroke(from, to) {
  drawCtx.save();
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.lineWidth = brushWidth();
  drawCtx.globalCompositeOperation = session.eraser ? "destination-out" : "source-over";
  drawCtx.strokeStyle = session.eraser ? "rgba(0,0,0,1)" : session.color;
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
  drawCtx.restore();
  session.hasInk = true;
}

function downloadName(item, includeRemix) {
  const stem = item.filename.replace(/\.[^.]+$/, "");
  const suffix = includeRemix ? "-remix" : "";
  return `${stem}${suffix}.png`.replace(/[\\/:*?"<>|]/g, "-");
}

function download() {
  if (!session.imageReady || !session.item) return;
  const output = document.createElement("canvas");
  output.width = base.width;
  output.height = base.height;
  const context = output.getContext("2d");
  context.drawImage(base, 0, 0);
  const includeRemix = !session.hidden && session.hasInk;
  if (!session.hidden) context.drawImage(draw, 0, 0);
  const name = downloadName(session.item, includeRemix);
  output.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

function hashValue() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

function placeFromLocation() {
  const value = hashValue();
  if (!value) return { view: "institutions" };
  if (value.startsWith("collection/")) {
    const slug = value.slice("collection/".length);
    return collectionBySlug.has(slug) ? { view: "collection", slug } : { view: "institutions" };
  }
  return byId.has(value) ? { view: "studio", id: value } : { view: "institutions" };
}

function collectionHash(slug) {
  return `#${encodeURIComponent(`collection/${slug}`)}`;
}

function pictureHash(id) {
  return `#${encodeURIComponent(id)}`;
}

function openCollection(slug) {
  history.pushState({ view: "collection", slug, canLeave: true }, "", collectionHash(slug));
  screen.pushed = true;
  showCollection(slug);
}

function openPicture(item) {
  pictureFocus = item.id;
  history.pushState({ view: "studio", id: item.id, canLeave: true }, "", pictureHash(item.id));
  session.pushed = true;
  showStudio(item);
}

function leaveCollection() {
  if (screen.name !== "collection") return;
  if (screen.pushed) {
    screen.pushed = false;
    history.back();
    return;
  }
  history.pushState({ view: "institutions" }, "", location.pathname + location.search);
  showInstitutions();
}

function leaveStudio() {
  if (studioView.hidden) return;
  if (session.pushed) {
    session.pushed = false;
    history.back();
    return;
  }
  const slug = session.item ? session.item.id.split("/")[0] : "";
  if (collectionBySlug.has(slug)) {
    history.pushState({ view: "collection", slug }, "", collectionHash(slug));
    showCollection(slug);
    return;
  }
  history.pushState({ view: "institutions" }, "", location.pathname + location.search);
  showInstitutions();
}

function showPlace(place) {
  session.pushed = Boolean(history.state && history.state.canLeave && place.view === "studio");
  screen.pushed = Boolean(history.state && history.state.canLeave && place.view === "collection");
  if (place.view === "studio") showStudio(byId.get(place.id));
  else if (place.view === "collection") showCollection(place.slug);
  else showInstitutions();
}

function onPopState() {
  showPlace(placeFromLocation());
}

COLORS.forEach((color) => {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.dataset.color = color;
  swatch.style.background = color;
  swatch.setAttribute("aria-label", color);
  swatch.setAttribute("aria-pressed", String(color === session.color));
  swatch.addEventListener("click", () => selectColor(color));
  colorGroup.append(swatch);
});

sizeInput.addEventListener("input", () => {
  session.size = Number(sizeInput.value);
});

eraserButton.addEventListener("click", () => setEraser(!session.eraser));

discardButton.addEventListener("click", () => {
  clearOverlay();
  setHidden(false);
});

hideButton.addEventListener("click", () => setHidden(!session.hidden));
downloadButton.addEventListener("click", download);
backButton.addEventListener("click", leaveStudio);

draw.addEventListener("pointerdown", (event) => {
  if (session.hidden || !session.imageReady || event.button !== 0) return;
  draw.setPointerCapture(event.pointerId);
  activePointer = event.pointerId;
  session.drawing = true;
  session.lastPoint = canvasPoint(event);
  stamp(session.lastPoint);
});

draw.addEventListener("pointermove", (event) => {
  if (!session.drawing || event.pointerId !== activePointer) return;
  const next = canvasPoint(event);
  stroke(session.lastPoint, next);
  session.lastPoint = next;
});

function endStroke(event) {
  if (event.pointerId !== activePointer) return;
  session.drawing = false;
  activePointer = null;
}

draw.addEventListener("pointerup", endStroke);
draw.addEventListener("pointercancel", endStroke);
draw.addEventListener("contextmenu", (event) => event.preventDefault());

archiveBack.addEventListener("click", leaveCollection);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!studioView.hidden) leaveStudio();
  else leaveCollection();
});

window.addEventListener("popstate", onPopState);
window.addEventListener("resize", applyDisplaySize);

if (!catalog) {
  showNotice("The catalog is missing. From the repository root, run python app/build.py.");
} else if (catalog.length === 0) {
  showNotice("No pictures are listed in the catalog yet.");
} else {
  const place = placeFromLocation();
  if (place.view === "studio") {
    history.replaceState({ view: "studio", id: place.id }, "", pictureHash(place.id));
  } else if (place.view === "collection") {
    history.replaceState({ view: "collection", slug: place.slug }, "", collectionHash(place.slug));
  } else {
    history.replaceState({ view: "institutions" }, "", location.pathname + location.search);
  }
  showPlace(place);
}
