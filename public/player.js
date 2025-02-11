const video = document.getElementById("video");
const playButton = document.getElementById("playButton");
const muteButton = document.getElementById("muteButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const progress = document.querySelector(".progress");
const progressFilled = document.querySelector(".progress-filled");
const volumeSlider = document.querySelector(".volume-slider");
const currentTimeElement = document.getElementById("currentTime");
const durationElement = document.getElementById("duration");

// Get video ID from URL manupilason breh
const urlParams = new URLSearchParams(window.location.search);
const type = urlParams.get("type");
const id = urlParams.get("id");
video.src = `/api/stream/${type}/${id}`;

const titleBar = document.getElementById("titleBar");

//updating the title of the page
async function updateTitle() {
  if (type === "episode") {
    const response = await fetch(`/api/episode-info/${id}`);
    const data = await response.json();
    titleBar.textContent = `${data.seriesTitle} - ${data.episodeTitle}`;
    document.title = `${data.seriesTitle} - ${data.episodeTitle}`;
  } else if (type === "movie") {
    const response = await fetch(`/api/movie-info/${id}`);
    const data = await response.json();
    titleBar.textContent = data.title;
    document.title = data.title;
  } else {
    titleBar.textContent = type || "Media Player";
    document.title = type || "Media Player";
  }
}

// Add after other declarations
const subtitleButton = document.getElementById("subtitleButton");
const subtitleMenu = document.querySelector(".subtitle-menu");
let currentSubtitles = [];

// Add subtitle handling
async function loadSubtitles(contentInfo) {
  const subtitleMenu = document.querySelector(".subtitle-menu");
  subtitleMenu.innerHTML =
    '<div class="subtitle-option active" data-value="off">Off</div>';

  if (contentInfo.subtitles && contentInfo.subtitles.length > 0) {
    currentSubtitles = contentInfo.subtitles;

    contentInfo.subtitles.forEach((sub, index) => {
      const option = document.createElement("div");
      option.className = "subtitle-option";
      option.dataset.value = index.toString();
      option.textContent = sub.titleOfSub;
      subtitleMenu.appendChild(option);
    });

    // Remove existing tracks
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
  }
}

async function updateContentInfo() {
  try {
    let data;
    if (type === "episode") {
      const response = await fetch(`/api/episode-info/${id}`);
      data = await response.json();
      document.getElementById("contentTitle").textContent = data.seriesTitle;
      document.getElementById(
        "contentDetails"
      ).textContent = `${data.episodeTitle}`;
      document.getElementById("contentCover").src = data.coverImage;
    } else if (type === "movie") {
      const response = await fetch(`/api/movie-info/${id}`);
      data = await response.json();
      document.getElementById("contentTitle").textContent = data.title;
      document.getElementById("contentCover").src = data.coverImage;
    }

    // Load subtitles
    await loadSubtitles(data);

    // Once the cover image is loaded, extract its dominant color
    const coverImg = document.getElementById("contentCover");
    coverImg.onload = function () {
      const color = getAverageColor(coverImg);
      document.querySelector(
        ".cover-shadow"
      ).style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    };
  } catch (error) {
    console.error("Error updating content info:", error);
  }
}

function getAverageColor(imgEl) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const width = (canvas.width =
    imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width);
  const height = (canvas.height =
    imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height);

  context.drawImage(imgEl, 0, 0);

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 20) {
    // Sample every 5th pixel for performance
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  return {
    r: Math.floor(r / count),
    g: Math.floor(g / count),
    b: Math.floor(b / count),
  };
}

updateTitle().then(() => {
  updateContentInfo();
});

// Play/Pause
function togglePlay() {
  if (video.paused) {
    video.play();
    playButton.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    centerPlayButton.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  } else {
    video.pause();
    playButton.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    centerPlayButton.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }
}

playButton.addEventListener("click", togglePlay);
video.addEventListener("click", togglePlay);

// Progress bar
video.addEventListener("timeupdate", () => {
  const percent = (video.currentTime / video.duration) * 100;
  progressFilled.style.width = `${percent}%`;
  currentTimeElement.textContent = formatTime(video.currentTime);
});

video.addEventListener("loadedmetadata", () => {
  durationElement.textContent = formatTime(video.duration);
});


const getVideoKey = () => `video_progress_${type}_${id}`;

// Create debounced save function with proper closure
const debouncedSave = (() => {
  let timeoutId = null;
  return (currentTime,time=1000) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(getVideoKey(), currentTime.toString());
      } catch (err) {
        console.error('Error saving progress:', err.message);
      }
    }, time);
  };
})();

// Click on progress bar
progress.addEventListener("click", (e) => {
  const progressTime = (e.offsetX / progress.offsetWidth) * video.duration;
  video.currentTime = progressTime;
  debouncedSave(progressTime,0);
});

// Volume
volumeSlider.addEventListener("input", (e) => {
  video.volume = e.target.value;
  muteButton.innerHTML =
    e.target.value === "0"
      ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
});

muteButton.addEventListener("click", () => {
  video.muted = !video.muted;
  muteButton.innerHTML = video.muted
    ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
});

// Fullscreen
fullscreenButton.addEventListener("click", () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    const isOk = confirm(
      "Do you want to open this video in VLC Player? " + video.src
    );
    if (!isOk) return;
    window.location.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(
      video.src
    )}&x-source=VLC%20Player&x-success=${window.location.href}`;
  }

  // Fallback for non-iOS
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  seconds = Math.floor(seconds % 60);
  return `${String(hours % 60).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const playlistContainer = document.getElementById("playlist");
const togglePlaylistBtn = document.querySelector(".toggle-playlist");
const seasonSelect = document.getElementById("seasonSelect");
const episodeList = document.getElementById("episodeList");
let seriesData = null;

togglePlaylistBtn.addEventListener("click", () => {
  playlistContainer.classList.toggle("active");
});

async function loadSeriesData(seriesTitle) {
  const response = await fetch(
    `/api/all-series/${encodeURIComponent(seriesTitle)}`
  );
  seriesData = await response.json();

  // Populate seasons dropdown
  seasonSelect.innerHTML = `
        <option value="" disabled>Select Season</option>
        ${seriesData.seasons
          .sort((a, b) => a.seasonNumber - b.seasonNumber)
          .map(
            (season) => `
            <option value="${season.seasonNumber}">Season ${season.seasonNumber}</option>
          `
          )
          .join("")}
      `;

  showEpisodesForSeason(seriesData.seasons[0].seasonNumber);
}

function showEpisodesForSeason(seasonNumber) {
  const season = seriesData.seasons.find(
    (s) => s.seasonNumber === parseInt(seasonNumber)
  );
  if (!season) return;

  episodeList.innerHTML = season.episodes
    .sort((a, b) => {
      const numA = parseInt(a.filePath.match(/e(\d+)/i)[1]);
      const numB = parseInt(b.filePath.match(/e(\d+)/i)[1]);
      return numA - numB;
    })
    .map(
      (episode) => `
          <li class="episode-item ${episode._id === id ? "active" : ""}" 
              onclick="playEpisode('${episode._id}')">
            ${episode.title}
          </li>
        `
    )
    .join("");
}

function playEpisode(episodeId) {
  location.href = `/player?type=episode&id=${episodeId}`;
}

seasonSelect.addEventListener("change", (e) => {
  showEpisodesForSeason(e.target.value);
});

// Initialize playlist if it's a series
if (type === "episode") {
  // Get series title from the URL or through an API call
  fetch(`/api/episode-info/${id}`)
    .then((response) => response.json())
    .then((data) => {
      loadSeriesData(data.seriesTitle);
      playlistContainer.classList.add("active");
    });
} else {
  togglePlaylistBtn.style.display = "none";
  playlistContainer.style.display = "none";
}

// Show controls on fullscreen
document.addEventListener("fullscreenchange", async () => {
  if (document.fullscreenElement) {
    videoContainer.classList.add("fullscreen");
    showControls();
  } else {
    videoContainer.classList.remove("fullscreen");
    controls.classList.add("show");
    await screen.orientation.unlock();
  }
});

// Ensure controls are visible in fullscreen on mouse move
let controlTimeout;
const controlsElement = document.querySelector(".controls");

document.addEventListener("mousemove", () => {
  if (document.fullscreenElement) {
    controls.classList.add("show");
    clearTimeout(controlTimeout);
    controlTimeout = setTimeout(() => {
      controls.classList.remove("show");
    }, 3000);
  } else {
    controls.classList.add("show");
    clearTimeout(controlTimeout);
    controlTimeout = setTimeout(() => {
      controls.classList.remove("show");
    }, 3000);
  }
});

// Remove default controls
video.removeAttribute("controls");

// Dynamic Ambient Shadow based on Video Colors
const ambientColor = getComputedStyle(
  document.documentElement
).getPropertyValue("--ambient-color");

// Create a hidden canvas to capture video frames
video.addEventListener("play", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  requestAnimationFrame(updateAmbientShadow);
});

function updateAmbientShadow() {
  if (video.paused || video.ended) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  // Sample every 10th pixel for performance
  for (let i = 0; i < data.length; i += 40) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  // Calculate average color
  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);

  // Set CSS variable for ambient color
  document.documentElement.style.setProperty(
    "--ambient-color",
    `rgba(${r}, ${g}, ${b}, 0.5)`
  );

  requestAnimationFrame(updateAmbientShadow);
}

// Updated controls visibility
const videoContainer = document.querySelector(".video-container");
const controls = document.querySelector(".controls");
let controlsTimeout;

function showControls() {
  clearTimeout(inactivityTimer);
  controls.classList.add("show");
  controls.classList.add("force-show");
  centerPlayButton.style.opacity = "1";
  videoContainer.style.cursor = "default";
  isControlsVisible = true;

  if (!video.paused) {
    inactivityTimer = setTimeout(hideControls, 3000);
  }
}

// Remove all other hideControls functions and keep this single optimized version
function hideControls() {
  if (subtitleMenu.classList.contains("active")) return;
  if (!video.paused && !controls.matches(":hover")) {
    controls.classList.remove("active");
    controls.classList.remove("visible");
    controls.classList.remove("force-show");
    controls.classList.remove("show");
    videoContainer.style.cursor = "none";
    centerPlayButton.style.opacity = "0";
    isControlsVisible = false;
  }
}

videoContainer.addEventListener("mousemove", showControls);
videoContainer.addEventListener("click", showControls);

// Improved ambient shadow implementation
const ambientShadow = document.getElementById("ambientShadow");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

function updateAmbientColor() {
  if (video.paused || video.ended) return;

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const colors = getEdgeColors(ctx, canvas.width, canvas.height);

    // Create gradient effect based on edge colors
    const gradient = `
      linear-gradient(135deg, 
        rgba(${colors.left.r}, ${colors.left.g}, ${colors.left.b}, 0.5),
        rgba(${colors.top.r}, ${colors.top.g}, ${colors.top.b}, 0.3),
        rgba(${colors.right.r}, ${colors.right.g}, ${colors.right.b}, 0.5),
        rgba(${colors.bottom.r}, ${colors.bottom.g}, ${colors.bottom.b}, 0.3)
      )
    `;

    ambientShadow.style.background = gradient;
  } catch (e) {
    console.log("Error sampling video colors:", e);
  }

  requestAnimationFrame(updateAmbientColor);
}

function getEdgeColors(ctx, width, height) {
  const edgeSize = 20; // Size of edge sampling area
  const colors = {
    left: { r: 0, g: 0, b: 0 },
    right: { r: 0, g: 0, b: 0 },
    top: { r: 0, g: 0, b: 0 },
    bottom: { r: 0, g: 0, b: 0 },
  };

  // Sample left edge
  const leftData = ctx.getImageData(0, 0, edgeSize, height).data;
  // Sample right edge
  const rightData = ctx.getImageData(
    width - edgeSize,
    0,
    edgeSize,
    height
  ).data;
  // Sample top edge
  const topData = ctx.getImageData(0, 0, width, edgeSize).data;
  // Sample bottom edge
  const bottomData = ctx.getImageData(
    0,
    height - edgeSize,
    width,
    edgeSize
  ).data;

  const processEdgeData = (data) => {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let i = 0; i < data.length; i += 16) {
      // Sample every 4th pixel
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    return {
      r: Math.floor(r / count),
      g: Math.floor(g / count),
      b: Math.floor(b / count),
    };
  };

  colors.left = processEdgeData(leftData);
  colors.right = processEdgeData(rightData);
  colors.top = processEdgeData(topData);
  colors.bottom = processEdgeData(bottomData);

  return colors;
}

// Update canvas setup
video.addEventListener("play", () => {
  canvas.width = 320; // Reduced size for better performance
  canvas.height = 180; // Maintain aspect ratio
  requestAnimationFrame(updateAmbientColor);
});

// Handle fullscreen changes
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    videoContainer.classList.add("fullscreen");
    showControls();
  } else {
    videoContainer.classList.remove("fullscreen");
    controls.classList.add("show");
  }
});

// Remove default controls
video.removeAttribute("controls");

// Add this after other variable declarations
const controlsTrigger = document.createElement("div");
controlsTrigger.className = "controls-trigger";
videoContainer.appendChild(controlsTrigger);

let inactivityTimer;
let isControlsVisible = false;

// Mouse move handler for the video container
videoContainer.addEventListener("mousemove", (e) => {
  const rect = videoContainer.getBoundingClientRect();
  const distanceFromBottom = rect.bottom - e.clientY;

  // Show controls if mouse is within 150px of bottom
  if (distanceFromBottom <= 150) {
    showControls();
  } else if (distanceFromBottom > 150 && !video.paused) {
    hideControls();
  }
});

// Keep controls visible while hovering over them
controls.addEventListener("mouseenter", () => {
  clearTimeout(inactivityTimer);
  controls.classList.add("force-show");
});

controls.addEventListener("mouseleave", () => {
  if (!video.paused) {
    controls.classList.remove("force-show");
    inactivityTimer = setTimeout(hideControls, 3000);
  }
});

// Show controls on video pause
video.addEventListener("pause", showControls);

// Hide controls on video play after delay
video.addEventListener("play", () => {
  inactivityTimer = setTimeout(hideControls, 3000);
});

// Reset controls visibility when leaving video container
videoContainer.addEventListener("mouseleave", () => {
  if (!video.paused) {
    hideControls();
  }
});

// Show controls on mobile touch
videoContainer.addEventListener("touchstart", () => {
  if (isControlsVisible) {
    hideControls();
  } else {
    showControls();
  }
});

const oldControlsTimeout = null;

let mouseTimer;
let isMouseMoving = false;
let lastMousePosition = { x: 0, y: 0 };

function setupControlsBehavior() {
  const container = videoContainer;
  let controlsVisible = false;

  function handleMouseMove(e) {
    // Check if mouse has actually moved
    if (
      lastMousePosition.x !== e.clientX ||
      lastMousePosition.y !== e.clientY
    ) {
      isMouseMoving = true;
      showControls();

      // Update last position
      lastMousePosition = { x: e.clientX, y: e.clientY };

      // Clear existing timers
      clearTimeout(mouseTimer);

      // Set new timer
      mouseTimer = setTimeout(() => {
        isMouseMoving = false;
        hideControls();
      }, 3000);
    }
  }

  // Event listeners
  container.addEventListener("mousemove", handleMouseMove);
  container.addEventListener("mouseleave", hideControls);

  // Keep controls visible when interacting with them
  controls.addEventListener("mouseenter", () => {
    clearTimeout(mouseTimer);
    showControls();
  });

  // Special cases
  video.addEventListener("pause", showControls);
  video.addEventListener("play", () => {
    mouseTimer = setTimeout(hideControls, 3000);
  });

  // Touch support
  let touchTimeout;
  container.addEventListener("touchstart", () => {
    if (controlsVisible) {
      hideControls();
    } else {
      showControls();
      clearTimeout(touchTimeout);
      touchTimeout = setTimeout(hideControls, 3000);
    }
  });

  // Fullscreen handling
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      showControls();
      setTimeout(hideControls, 3000);
    } else {
      showControls();
    }
  });
}

// Initialize controls behavior
setupControlsBehavior();

// Add keyboard shortcuts
const volumeIndicator = document.querySelector(".volume-indicator");
const volumeBarFill = document.querySelector(".volume-bar-fill");
let volumeTimeout;

function showVolumeIndicator() {
  volumeIndicator.classList.add("visible");
  volumeBarFill.style.width = `${video.volume * 100}%`;
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => {
    volumeIndicator.classList.remove("visible");
  }, 1500);
}

function isPlayerInFocus() {
  return (
    document.activeElement === video ||
    videoContainer.contains(document.activeElement) ||
    document.activeElement === document.body
  );
}

// Replace the existing keyboard handler
function handleKeyboard(e) {
  // Only handle shortcuts if player is in focus
  if (!isPlayerInFocus()) return;

  // Prevent scrolling for spacebar
  if (e.code === "Space") {
    e.preventDefault();
  }

  // Prevent default for media keys
  if (["ArrowUp", "ArrowDown", "KeyF", "KeyM"].includes(e.code)) {
    e.preventDefault();
  }

  switch (e.code) {
    case "Space":
      togglePlay();
      break;
    case "KeyF":
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoContainer.requestFullscreen();
      }
      break;
    case "KeyM":
      video.muted = !video.muted;
      muteButton.innerHTML = video.muted ? muteIcon : unmuteIcon;
      break;
    case "ArrowUp":
      video.volume = Math.min(1, video.volume + 0.1);
      showVolumeIndicator();
      volumeSlider.value = video.volume;
      break;
    case "ArrowDown":
      video.volume = Math.max(0, video.volume - 0.1);
      showVolumeIndicator();
      volumeSlider.value = video.volume;
      break;
    case "ArrowLeft":
      video.currentTime = Math.max(0, video.currentTime - 10);
      showSkipIndicator("backward");
      break;
    case "ArrowRight":
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
      showSkipIndicator("forward");
      break;
  }
}

// Change event listener to capture events in the capture phase
document.addEventListener("keydown", handleKeyboard, true);

// Update existing volume handling
function updateVolume(value) {
  video.volume = value;
  volumeSlider.value = value;
  updateVolumeIndicator(value);
  muteButton.innerHTML = value === 0 ? muteIcon : unmuteIcon;
}

volumeSlider.addEventListener("input", (e) => {
  updateVolume(e.target.value);
});

// Icons for consistency (add these at the top of your script)
const muteIcon = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
const unmuteIcon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

// Add skip buttons functionality
const backwardButton = document.getElementById("backwardButton");
const forwardButton = document.getElementById("forwardButton");
const skipBackward = document.querySelector(".skip-indicator.backward");
const skipForward = document.querySelector(".skip-indicator.forward");
let skipTimeout;

function showSkipIndicator(direction) {
  const indicator = direction === "forward" ? skipForward : skipBackward;
  indicator.classList.add("visible");
  clearTimeout(skipTimeout);
  skipTimeout = setTimeout(() => {
    indicator.classList.remove("visible");
  }, 500);
}

backwardButton.addEventListener("click", () => {
  video.currentTime = Math.max(0, video.currentTime - 10);
  showSkipIndicator("backward");
});

forwardButton.addEventListener("click", () => {
  video.currentTime = Math.min(video.duration, video.currentTime + 10);
  showSkipIndicator("forward");
});

// Update volume indicator to show different icon based on volume level
function updateVolumeIndicator(value) {
  volumeIndicator.classList.toggle("high", value > 0.5);
  volumeBarFill.style.width = `${value * 100}%`;
  volumeIndicator.classList.add("visible");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => {
    volumeIndicator.classList.remove("visible");
  }, 1500);
}

// Update existing volume handlers
function updateVolume(value) {
  video.volume = value;
  volumeSlider.value = value;
  updateVolumeIndicator(value);
  muteButton.innerHTML = value === 0 ? muteIcon : unmuteIcon;
}

// Update keyboard handler
function handleKeyboard(e) {
  // Only handle shortcuts if player is in focus
  if (!isPlayerInFocus()) return;

  // Prevent scrolling for spacebar
  if (e.code === "Space") {
    e.preventDefault();
  }

  // Prevent default for media keys
  if (["ArrowUp", "ArrowDown", "KeyF", "KeyM"].includes(e.code)) {
    e.preventDefault();
  }

  switch (e.code) {
    case "ArrowLeft":
      video.currentTime = Math.max(0, video.currentTime - 10);
      showSkipIndicator("backward");
      break;
    case "ArrowRight":
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
      showSkipIndicator("forward");
      break;
    case "ArrowUp":
      video.volume = Math.min(1, video.volume + 0.1);
      updateVolumeIndicator(video.volume);
      volumeSlider.value = video.volume;
      break;
    case "ArrowDown":
      video.volume = Math.max(0, video.volume - 0.1);
      updateVolumeIndicator(video.volume);
      volumeSlider.value = video.volume;
      break;
    case "Space":
      togglePlay();
      break;
    case "KeyF":
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoContainer.requestFullscreen();
      }
      break;
    case "KeyM":
      video.muted = !video.muted;
      muteButton.innerHTML = video.muted ? muteIcon : unmuteIcon;
      break;
  }
}

// Add these after other variable declarations
const centerPlayButton = document.getElementById("centerPlayButton");

// Add loading state handlers
video.addEventListener("waiting", () => {
  videoContainer.classList.add("loading");
});

video.addEventListener("canplay", () => {
  videoContainer.classList.remove("loading");
});

// Add center play button handler
centerPlayButton.addEventListener("click", togglePlay);

// Show center play button when video ends
video.addEventListener("ended", () => {
  centerPlayButton.style.opacity = "1";
});

togglePlaylistBtn.addEventListener("click", () => {
  playlistContainer.classList.toggle("active");
});

// Close playlist when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768) {
    if (
      !playlistContainer.contains(e.target) &&
      !togglePlaylistBtn.contains(e.target) &&
      playlistContainer.classList.contains("active")
    ) {
      playlistContainer.classList.remove("active");
    }
  }
});

// Add after other event listeners
const contentInfo = document.querySelector(".content-info");

video.addEventListener("play", () => {
  contentInfo.classList.add("dimmed");
});

video.addEventListener("pause", () => {
  contentInfo.classList.remove("dimmed");
});

video.addEventListener("ended", () => {
  contentInfo.classList.remove("dimmed");
});

const vlcButton = document.getElementById("openVLC");

vlcButton.addEventListener("click", (e) => {
  e.preventDefault();
  const copy = confirm(
    "copy this link and open it in VLC Player: " +
      video.src +
      " click ok to copy"
  );
  if (copy) {
    navigator.clipboard.writeText(video.src);
  }
});

// Add after other button declarations
const theaterButton = document.getElementById("theaterButton");

// Add theater mode toggle function
function toggleTheaterMode() {
  document.body.classList.toggle("theater-mode");
  const contentInfo = document.querySelector(".content-info");
  const playlist = document.getElementById("playlist");

  if (document.body.classList.contains("theater-mode")) {
    contentInfo.style.display = "none";
    playlist.style.display = "none";
    vlcButton.style.display = "none";
  } else {
    contentInfo.style.display = "block";
    vlcButton.style.display = "block";
    if (type === "episode") {
      playlist.style.display = "block";
    }
  }

  // Ensure ambient shadow is properly positioned in theater mode
  const ambientShadow = document.getElementById("ambientShadow");
  if (document.body.classList.contains("theater-mode")) {
    ambientShadow.style.position = "fixed";
    // Force a reflow of ambient colors
    updateAmbientColor();
  } else {
    ambientShadow.style.position = "absolute";
  }

  theaterButton.innerHTML = document.body.classList.contains("theater-mode")
    ? '<svg viewBox="0 0 24 24"><path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/></svg>';
}

// Add the event listener for theater mode
theaterButton.addEventListener("click", toggleTheaterMode);

// Update fullscreen change handler to handle theater mode properly
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    videoContainer.classList.add("fullscreen");
    if (document.body.classList.contains("theater-mode")) {
      document.body.classList.remove("theater-mode");
      theaterButton.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/></svg>';
    }
    showControls();
  } else {
    videoContainer.classList.remove("fullscreen");
    controls.classList.add("show");
  }
});

// Add progress bar hover functionality
const progressTooltip = document.querySelector(".progress-tooltip");

progress.addEventListener("mousemove", (e) => {
  const percent = e.offsetX / progress.offsetWidth;
  const previewTime = percent * video.duration;
  progressTooltip.textContent = formatTime(previewTime);
  progressTooltip.style.left = `${e.offsetX}px`;
});

// Update mouse move handler
videoContainer.addEventListener("mousemove", (e) => {
  if (!isControlsVisible) {
    showControls();
  }
  // Reset timer
  clearTimeout(inactivityTimer);
  if (!video.paused) {
    inactivityTimer = setTimeout(hideControls, 3000);
  }
});

// Add handler for controls hover
controls.addEventListener("mouseenter", () => {
  clearTimeout(inactivityTimer);
  controls.classList.add("force-show");
});

controls.addEventListener("mouseleave", () => {
  if (!video.paused) {
    controls.classList.remove("force-show");
    inactivityTimer = setTimeout(hideControls, 3000);
  }
});

// Add subtitle selection handling
subtitleButton.addEventListener("click", (e) => {
  e.stopPropagation();
  subtitleMenu.classList.toggle("active");
});

document.addEventListener("click", (e) => {
  if (!subtitleMenu.contains(e.target) && !subtitleButton.contains(e.target)) {
    subtitleMenu.classList.remove("active");
  }
});

subtitleMenu.addEventListener("click", (e) => {
  const option = e.target.closest(".subtitle-option");
  if (!option) return;

  // Remove existing tracks
  const tracks = video.getElementsByTagName("track");
  while (tracks.length > 0) {
    video.removeChild(tracks[0]);
  }

  // Remove active class from all options
  subtitleMenu.querySelectorAll(".subtitle-option").forEach((opt) => {
    opt.classList.remove("active");
  });
  option.classList.add("active");

  const value = option.dataset.value;
  if (value === "off") {
    // Subtitles off
    return;
  }

  // Add new track
  const track = document.createElement("track");
  const subtitle = currentSubtitles[parseInt(value)];
  track.kind = "subtitles";
  track.label = subtitle.titleOfSub;
  track.src = subtitle.file;
  track.default = true;
  video.appendChild(track);
});



// Save progress every 5 seconds
video.addEventListener('timeupdate', () => {
  // Only save if more than 2 seconds have been played and video is not ended
  if (video.currentTime > 2 && !video.ended) {
    debouncedSave(video.currentTime);
  }
});

// Load saved progress when metadata is loaded
video.addEventListener('loadedmetadata', () => {
  try {
    const savedTime = localStorage.getItem(getVideoKey());
    if (savedTime) {
      const parsedTime = parseFloat(savedTime);
      // Only restore if less than 98% complete
      if (parsedTime < (video.duration * 0.98)) {
        video.currentTime = parsedTime;
      }
    }
  } catch (err) {
    console.error('Error loading progress:', err.message);
  }
});

// Clear progress when video ends
video.addEventListener('ended', () => {
  try {
    localStorage.removeItem(getVideoKey());
  } catch (err) {
    console.error('Error clearing progress:', err.message);
  }
});
