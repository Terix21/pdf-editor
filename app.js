/**
 * GhostEdit - Client-side Secure PDF Editor & Redactor
 * Logic & Interactivity
 */

// Application State
let state = {
    pdfBytes: null,       // Original PDF ArrayBuffer
    pdfDoc: null,         // pdf-lib PDFDocument
    pdfJS: null,          // PDF.js Document
    fileName: '',
    pages: {},            // Map of pageId -> pageData (rotation, originalIndex, annotations)
    pageOrder: [],        // Ordered list of pageIds
    currentPageIndex: 0,  // Index in pageOrder
    scale: 1.2,           // Rendering Zoom scale
    activeTool: 'select', // 'select' | 'text' | 'highlight' | 'draw' | 'redact'
    selectedAnnotation: null,
    
    // Canvas interactions
    isDrawing: false,
    drawPoints: [],
    startX: 0,
    startY: 0,
    activeRect: null,
    isDraggingElement: false,
    dragStartX: 0,
    dragStartY: 0,
    elemOrigX: 0,
    elemOrigY: 0,
    elemOrigPoints: null,
    
    // Settings defaults
    activeColor: '#ef4444',
    activeThickness: 4,
    activeOpacity: 100,
    activeFontSize: 16,
    activeAlign: 'left',
    
    // Undo/Redo Stacks
    undoStack: [],
    redoStack: []
};

// Preset colors matching CSS variables
const COLOR_MAP = {
    '#000000': 'Black',
    '#ffffff': 'White',
    '#ef4444': 'Red',
    '#3b82f6': 'Blue',
    '#10b981': 'Green',
    '#f59e0b': 'Yellow',
    '#8b5cf6': 'Purple'
};

// UI Elements
const els = {};

function initSelectors() {
    els.fileSelector = document.getElementById('file-selector');
    els.btnUpload = document.getElementById('btn-upload');
    els.btnBrowse = document.getElementById('btn-browse');
    els.dropZone = document.getElementById('drop-zone');
    els.welcomeScreen = document.getElementById('welcome-screen');
    els.viewportWrapper = document.getElementById('viewport-wrapper');
    els.viewport = document.getElementById('viewport');
    
    els.fileInfoBadge = document.getElementById('file-info-badge');
    els.currentFilename = document.getElementById('current-filename');
    els.currentPageCount = document.getElementById('current-page-count');
    
    els.btnZoomOut = document.getElementById('btn-zoom-out');
    els.btnZoomIn = document.getElementById('btn-zoom-in');
    els.zoomText = document.getElementById('zoom-text');
    els.btnFitWidth = document.getElementById('btn-fit-width');
    els.btnFitPage = document.getElementById('btn-fit-page');
    
    els.editToolsGroup = document.getElementById('edit-tools-group');
    els.toolSelect = document.getElementById('tool-select');
    els.toolText = document.getElementById('tool-text');
    els.toolHighlight = document.getElementById('tool-highlight');
    els.toolDraw = document.getElementById('tool-draw');
    els.toolRedact = document.getElementById('tool-redact');
    
    els.btnUndo = document.getElementById('btn-undo');
    els.btnRedo = document.getElementById('btn-redo');
    
    els.exportDropdown = document.getElementById('export-dropdown');
    els.exportStandard = document.getElementById('export-standard');
    els.exportSecure = document.getElementById('export-secure');
    
    els.leftSidebar = document.getElementById('left-sidebar');
    els.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    els.thumbnailContainer = document.getElementById('thumbnail-container');
    
    els.pageNavOverlay = document.getElementById('page-nav-overlay');
    els.lblCurrentPage = document.getElementById('lbl-current-page');
    els.lblTotalPages = document.getElementById('lbl-total-pages');
    els.navPrevPage = document.getElementById('nav-prev-page');
    els.navNextPage = document.getElementById('nav-next-page');
    
    els.rightSidebar = document.getElementById('right-sidebar');
    els.inspectorContent = document.getElementById('inspector-content');
    els.inspectorEmptyMsg = document.getElementById('inspector-empty-msg');
    els.inspectorSectionProps = document.getElementById('inspector-section-props');
    els.propFontSize = document.getElementById('prop-font-size');
    els.lblFontSize = document.getElementById('lbl-font-size');
    els.propOpacity = document.getElementById('prop-opacity');
    els.lblOpacity = document.getElementById('lbl-opacity');
    els.propThickness = document.getElementById('prop-thickness');
    els.lblThickness = document.getElementById('lbl-thickness');
    els.colorSwatches = document.querySelectorAll('.color-swatch');
    els.segBtns = document.querySelectorAll('.seg-btn');
    els.btnDeleteElement = document.getElementById('btn-delete-element');
    els.redactSecurityWarning = document.getElementById('redact-security-warning');
    
    els.btnCloseFile = document.getElementById('btn-close-file');
    els.toastContainer = document.getElementById('toast-container');
    els.loadingOverlay = document.getElementById('loading-overlay');
    els.loadingMessage = document.getElementById('loading-message');
    
    els.pageContainer = document.getElementById('page-container');
    els.pdfCanvas = document.getElementById('pdf-canvas');
    els.annotationCanvas = document.getElementById('annotation-canvas');
    els.textOverlayLayer = document.getElementById('text-overlay-layer');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    setupEventListeners();
    lucide.createIcons();

    // Auto-load sample.pdf for testing/verification when query string has test=true
    if (window.location.search.includes('test=true')) {
        showLoading('Auto-loading test PDF...');
        fetch('/sample.pdf')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch sample.pdf');
                return res.arrayBuffer();
            })
            .then(async (bytes) => {
                state.fileName = 'sample.pdf';
                state.pdfBytes = bytes;
                state.pdfJS = await pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) }).promise;
                state.pages = {};
                state.pageOrder = [];
                const numPages = state.pdfJS.numPages;
                for (let i = 0; i < numPages; i++) {
                    const pageId = `page-${Date.now()}-${i}`;
                    state.pages[pageId] = {
                        id: pageId,
                        originalIndex: i,
                        rotation: 0,
                        annotations: []
                    };
                    state.pageOrder.push(pageId);
                }
                state.currentPageIndex = 0;
                state.undoStack = [];
                state.redoStack = [];
                updateUndoRedoButtons();
                
                els.welcomeScreen.style.display = 'none';
                els.viewportWrapper.style.display = 'block';
                els.pageNavOverlay.style.display = 'flex';
                els.fileInfoBadge.style.display = 'flex';
                els.btnCloseFile.style.display = 'inline-flex';
                els.currentFilename.textContent = state.fileName;
                els.currentPageCount.textContent = `${numPages} page${numPages > 1 ? 's' : ''}`;
                els.lblTotalPages.textContent = numPages;
                els.exportDropdown.style.display = 'inline-block';
                els.editToolsGroup.style.pointerEvents = 'auto';
                els.editToolsGroup.style.opacity = '1';
                els.btnZoomIn.disabled = false;
                els.btnZoomOut.disabled = false;
                els.btnFitWidth.disabled = false;
                els.btnFitPage.disabled = false;
                
                els.leftSidebar.classList.remove('collapsed');
                const icon = els.btnToggleSidebar.querySelector('i, svg');
                if (icon) icon.setAttribute('data-lucide', 'chevron-left');
                lucide.createIcons();
                
                selectTool('select');
                await fitToWidth();
                await renderThumbnails();
                
                showToast('Test PDF auto-loaded successfully!');
            })
            .catch(err => {
                console.error('Error auto-loading PDF:', err);
                showToast('Failed to auto-load test PDF.', 'error');
            })
            .finally(() => {
                hideLoading();
            });
    }
});

// Setup event listeners
function setupEventListeners() {
    // File upload actions
    els.btnUpload.addEventListener('click', () => els.fileSelector.click());
    els.btnBrowse.addEventListener('click', () => els.fileSelector.click());
    els.fileSelector.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    els.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.dropZone.classList.add('dragover');
    });
    els.dropZone.addEventListener('dragleave', () => {
        els.dropZone.classList.remove('dragover');
    });
    els.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Sidebar toggles
    els.btnToggleSidebar.addEventListener('click', () => {
        els.leftSidebar.classList.toggle('collapsed');
        const icon = els.btnToggleSidebar.querySelector('i, svg');
        if (icon) {
            if (els.leftSidebar.classList.contains('collapsed')) {
                icon.setAttribute('data-lucide', 'chevron-right');
            } else {
                icon.setAttribute('data-lucide', 'chevron-left');
            }
        }
        lucide.createIcons();
    });

    // Zoom Controls
    els.btnZoomIn.addEventListener('click', () => {
        state.scale = Math.min(3.0, state.scale + 0.1);
        updateZoomText();
        renderCurrentPage();
    });
    els.btnZoomOut.addEventListener('click', () => {
        state.scale = Math.max(0.5, state.scale - 0.1);
        updateZoomText();
        renderCurrentPage();
    });
    els.btnFitWidth.addEventListener('click', fitToWidth);
    els.btnFitPage.addEventListener('click', fitToPage);

    // Tools setup
    const tools = [
        { el: els.toolSelect, name: 'select' },
        { el: els.toolText, name: 'text' },
        { el: els.toolHighlight, name: 'highlight' },
        { el: els.toolDraw, name: 'draw' },
        { el: els.toolRedact, name: 'redact' }
    ];
    
    tools.forEach(t => {
        t.el.addEventListener('click', () => selectTool(t.name));
    });

    // Navigation
    els.navPrevPage.addEventListener('click', prevPage);
    els.navNextPage.addEventListener('click', nextPage);

    // Inspector events
    els.propFontSize.addEventListener('input', (e) => {
        state.activeFontSize = parseInt(e.target.value);
        els.lblFontSize.textContent = `${state.activeFontSize}px`;
        updateSelectedAnnotationProperty('size', state.activeFontSize);
    });

    els.propOpacity.addEventListener('input', (e) => {
        state.activeOpacity = parseInt(e.target.value);
        els.lblOpacity.textContent = `${state.activeOpacity}%`;
        updateSelectedAnnotationProperty('opacity', state.activeOpacity / 100);
    });

    els.propThickness.addEventListener('input', (e) => {
        state.activeThickness = parseInt(e.target.value);
        els.lblThickness.textContent = `${state.activeThickness}px`;
        updateSelectedAnnotationProperty('thickness', state.activeThickness);
    });

    els.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            els.colorSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.activeColor = swatch.getAttribute('data-color');
            updateSelectedAnnotationProperty('color', state.activeColor);
        });
    });

    els.segBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.segBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeAlign = btn.getAttribute('data-align');
            updateSelectedAnnotationProperty('align', state.activeAlign);
        });
    });

    els.btnDeleteElement.addEventListener('click', deleteSelectedAnnotation);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.pdfBytes === null) return;
        
        // Escape to cancel selection or return to select tool
        if (e.key === 'Escape') {
            deselectAnnotation();
            selectTool('select');
        }
        
        // Delete or Backspace to delete selected annotation
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedAnnotation) {
            // Check if editing text to prevent deleting annotation while writing
            if (document.activeElement && document.activeElement.classList.contains('text-annotation-item')) {
                return;
            }
            deleteSelectedAnnotation();
        }

        // Ctrl + Z (Undo)
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }

        // Ctrl + Y (Redo)
        if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        }

        // Quick keys for tools (if not typing)
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.classList.contains('text-annotation-item'))) {
            return;
        }
        if (e.key.toLowerCase() === 'v') selectTool('select');
        if (e.key.toLowerCase() === 't') selectTool('text');
        if (e.key.toLowerCase() === 'h') selectTool('highlight');
        if (e.key.toLowerCase() === 'd') selectTool('draw');
        if (e.key.toLowerCase() === 'r') selectTool('redact');
    });

    // Undo / Redo Buttons
    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);
    els.btnCloseFile.addEventListener('click', closeCurrentFile);

    // Export Dropdown Trigger
    els.exportStandard.addEventListener('click', () => doExport(false));
    els.exportSecure.addEventListener('click', () => doExport(true));

    // Canvas Mouse listeners for drawing/redacting/selecting
    els.annotationCanvas.addEventListener('mousedown', handleMouseDown);
    els.annotationCanvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

// Show loading indicator
function showLoading(msg) {
    els.loadingMessage.textContent = msg;
    els.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    els.loadingOverlay.style.display = 'none';
}

// Toast System
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'info') iconName = 'info';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${msg}</span>
    `;
    els.toastContainer.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.2s ease reverse';
        setTimeout(() => toast.remove(), 200);
    }, 3500);
}

// File loading
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        showToast('Only PDF files are supported.', 'error');
        return;
    }
    
    showLoading('Parsing PDF document locally...');
    state.fileName = file.name;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            state.pdfBytes = e.target.result;
            
            // Load PDFJS for rendering
            state.pdfJS = await pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) }).promise;
            
            // Reset page configurations
            state.pages = {};
            state.pageOrder = [];
            
            const numPages = state.pdfJS.numPages;
            for (let i = 0; i < numPages; i++) {
                const pageId = `page-${Date.now()}-${i}`;
                state.pages[pageId] = {
                    id: pageId,
                    originalIndex: i,
                    rotation: 0,
                    annotations: []
                };
                state.pageOrder.push(pageId);
            }
            
            state.currentPageIndex = 0;
            state.undoStack = [];
            state.redoStack = [];
            updateUndoRedoButtons();
            
            // UI Adjustments
            els.welcomeScreen.style.display = 'none';
            els.viewportWrapper.style.display = 'block';
            els.pageNavOverlay.style.display = 'flex';
            els.fileInfoBadge.style.display = 'flex';
            els.btnCloseFile.style.display = 'inline-flex';
            els.currentFilename.textContent = state.fileName;
            els.currentPageCount.textContent = `${numPages} page${numPages > 1 ? 's' : ''}`;
            els.lblTotalPages.textContent = numPages;
            els.exportDropdown.style.display = 'inline-block';
            els.editToolsGroup.style.pointerEvents = 'auto';
            els.editToolsGroup.style.opacity = '1';
            els.btnZoomIn.disabled = false;
            els.btnZoomOut.disabled = false;
            els.btnFitWidth.disabled = false;
            els.btnFitPage.disabled = false;
            
            els.leftSidebar.classList.remove('collapsed');
            const icon = els.btnToggleSidebar.querySelector('i, svg');
            if (icon) icon.setAttribute('data-lucide', 'chevron-left');
            lucide.createIcons();

            // Set tool to pointer/select initially
            selectTool('select');
            
            // Adjust zoom to fit width
            await fitToWidth();
            await renderThumbnails();
            
            showToast('PDF loaded successfully!');
        } catch (err) {
            console.error(err);
            showToast('Failed to load PDF. Might be corrupted or encrypted.', 'error');
        } finally {
            hideLoading();
        }
    };
    reader.readAsArrayBuffer(file);
}

// Close the current PDF file and return to the welcome screen
function closeCurrentFile() {
    state.pdfBytes = null;
    state.pdfJS = null;
    state.fileName = '';
    state.pages = {};
    state.pageOrder = [];
    state.currentPageIndex = 0;
    state.undoStack = [];
    state.redoStack = [];
    state.selectedAnnotation = null;
    updateUndoRedoButtons();
    
    // UI adjustments
    els.welcomeScreen.style.display = 'flex';
    els.viewportWrapper.style.display = 'none';
    els.pageNavOverlay.style.display = 'none';
    els.fileInfoBadge.style.display = 'none';
    els.exportDropdown.style.display = 'none';
    els.btnCloseFile.style.display = 'none';
    
    // Disable edit tools
    els.editToolsGroup.style.pointerEvents = 'none';
    els.editToolsGroup.style.opacity = '0.5';
    
    // Disable zoom buttons
    els.btnZoomIn.disabled = true;
    els.btnZoomOut.disabled = true;
    els.btnFitWidth.disabled = true;
    els.btnFitPage.disabled = true;
    
    // Collapse sidebars
    els.leftSidebar.classList.add('collapsed');
    els.rightSidebar.classList.add('collapsed');
    const icon = els.btnToggleSidebar.querySelector('i, svg');
    if (icon) icon.setAttribute('data-lucide', 'chevron-right');
    lucide.createIcons();
    
    // Clear canvases and text layer
    const canvasCtx = els.pdfCanvas.getContext('2d');
    canvasCtx.clearRect(0, 0, els.pdfCanvas.width, els.pdfCanvas.height);
    const annCtx = els.annotationCanvas.getContext('2d');
    annCtx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);
    els.textOverlayLayer.innerHTML = '';
    els.thumbnailContainer.innerHTML = '';
    
    showToast('Document closed.', 'info');
}

// Navigation functions
async function prevPage() {
    if (state.currentPageIndex > 0) {
        state.currentPageIndex--;
        deselectAnnotation();
        await renderCurrentPage();
        highlightActiveThumbnail();
    }
}

async function nextPage() {
    if (state.currentPageIndex < state.pageOrder.length - 1) {
        state.currentPageIndex++;
        deselectAnnotation();
        await renderCurrentPage();
        highlightActiveThumbnail();
    }
}

function updatePageIndicator() {
    els.lblCurrentPage.textContent = state.currentPageIndex + 1;
    els.lblTotalPages.textContent = state.pageOrder.length;
    
    els.navPrevPage.disabled = state.currentPageIndex === 0;
    els.navNextPage.disabled = state.currentPageIndex === state.pageOrder.length - 1;
}

// Tool Selection
function selectTool(toolName) {
    state.activeTool = toolName;
    
    // UI Button Updates
    const tools = {
        'select': els.toolSelect,
        'text': els.toolText,
        'highlight': els.toolHighlight,
        'draw': els.toolDraw,
        'redact': els.toolRedact
    };
    
    Object.keys(tools).forEach(key => {
        if (key === toolName) {
            tools[key].classList.add('active');
        } else {
            tools[key].classList.remove('active');
        }
    });

    // Reset cursor / layout class
    if (toolName === 'select') {
        els.pageContainer.className = 'pdf-page-container tool-select';
    } else {
        els.pageContainer.className = 'pdf-page-container';
    }

    deselectAnnotation();
    updateInspector();
}

// Zoom fitting
function fitToWidth() {
    if (!state.pdfJS) return Promise.resolve();
    return state.pdfJS.getPage(getCurrentPageData().originalIndex + 1).then(page => {
        const rotation = getCurrentPageData().rotation;
        const viewport = page.getViewport({ scale: 1, rotation });
        const viewportWidth = els.viewport.clientWidth - 80; // Margin buffer
        state.scale = viewportWidth / viewport.width;
        updateZoomText();
        return renderCurrentPage();
    });
}

function fitToPage() {
    if (!state.pdfJS) return Promise.resolve();
    return state.pdfJS.getPage(getCurrentPageData().originalIndex + 1).then(page => {
        const rotation = getCurrentPageData().rotation;
        const viewport = page.getViewport({ scale: 1, rotation });
        
        const viewportWidth = els.viewport.clientWidth - 80;
        const viewportHeight = els.viewport.clientHeight - 80;
        
        const scaleX = viewportWidth / viewport.width;
        const scaleY = viewportHeight / viewport.height;
        
        state.scale = Math.min(scaleX, scaleY);
        updateZoomText();
        return renderCurrentPage();
    });
}

function updateZoomText() {
    els.zoomText.textContent = `${Math.round(state.scale * 100)}%`;
}

// Core Page Rendering
function getCurrentPageId() {
    return state.pageOrder[state.currentPageIndex];
}

function getCurrentPageData() {
    return state.pages[getCurrentPageId()];
}

async function renderCurrentPage() {
    if (!state.pdfJS) return;
    
    const pageId = getCurrentPageId();
    const pageData = state.pages[pageId];
    
    try {
        const page = await state.pdfJS.getPage(pageData.originalIndex + 1);
        
        // Calculate viewport
        const viewport = page.getViewport({ scale: state.scale, rotation: pageData.rotation });
        
        // Setup canvases dimensions
        els.pageContainer.style.width = `${viewport.width}px`;
        els.pageContainer.style.height = `${viewport.height}px`;
        
        els.pdfCanvas.width = viewport.width;
        els.pdfCanvas.height = viewport.height;
        els.pdfCanvas.style.width = '100%';
        els.pdfCanvas.style.height = '100%';
        
        els.annotationCanvas.width = viewport.width;
        els.annotationCanvas.height = viewport.height;
        els.annotationCanvas.style.width = '100%';
        els.annotationCanvas.style.height = '100%';
        
        // Render PDF contents on bottom canvas
        const canvasCtx = els.pdfCanvas.getContext('2d');
        const renderContext = {
            canvasContext: canvasCtx,
            viewport: viewport
        };
        
        if (state.currentRenderTask) {
            try {
                state.currentRenderTask.cancel();
            } catch (cErr) {
                // Ignore cancellation error
            }
        }
        
        state.currentRenderTask = page.render(renderContext);
        
        try {
            await state.currentRenderTask.promise;
            state.currentRenderTask = null;
        } catch (renderErr) {
            if (renderErr.name === 'RenderingCancelledException') {
                // Expected cancellation, don't show error toast or throw
                return;
            }
            throw renderErr;
        }
        
        // Render annotation overlays
        redrawAnnotations();
        syncTextAnnotations();
        updatePageIndicator();
    } catch (err) {
        console.error(err);
        showToast('Error rendering page.', 'error');
    }
}

// Render all Sidebar thumbnails
async function renderThumbnails() {
    if (!state.pdfJS) return;
    
    els.thumbnailContainer.innerHTML = '';
    
    for (let i = 0; i < state.pageOrder.length; i++) {
        const pageId = state.pageOrder[i];
        const pageData = state.pages[pageId];
        
        const card = document.createElement('div');
        card.className = `thumbnail-card ${i === state.currentPageIndex ? 'active' : ''}`;
        card.setAttribute('data-page-id', pageId);
        
        card.innerHTML = `
            <div class="thumbnail-canvas-container">
                <canvas></canvas>
            </div>
            <div class="thumbnail-info">
                <span class="thumbnail-index">Page ${i + 1}</span>
                <div class="thumbnail-actions">
                    <button class="thumbnail-btn btn-rotate" title="Rotate 90°">
                        <i data-lucide="rotate-cw"></i>
                    </button>
                    <button class="thumbnail-btn btn-delete" title="Delete Page">
                        <i data-lucide="trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        els.thumbnailContainer.appendChild(card);
        
        const canvas = card.querySelector('canvas');
        renderThumbnailPage(pageData.originalIndex, pageData.rotation, canvas);
        
        // Click to navigate
        card.addEventListener('click', (e) => {
            if (e.target.closest('.thumbnail-btn')) return; // Ignore buttons
            const idx = state.pageOrder.indexOf(pageId);
            if (idx !== -1) {
                state.currentPageIndex = idx;
                deselectAnnotation();
                renderCurrentPage();
                highlightActiveThumbnail();
            }
        });
        
        // Rotate Action
        card.querySelector('.btn-rotate').addEventListener('click', (e) => {
            e.stopPropagation();
            rotatePage(pageId, 90);
        });
        
        // Delete Action
        card.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePage(pageId);
        });
    }
    
    lucide.createIcons();
    setupThumbnailSorting();
}

// Quick thumbnail page renderer
async function renderThumbnailPage(originalIndex, rotation, canvas) {
    try {
        const page = await state.pdfJS.getPage(originalIndex + 1);
        const viewport = page.getViewport({ scale: 0.2, rotation });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
    } catch (err) {
        console.error(err);
    }
}

function highlightActiveThumbnail() {
    const cards = els.thumbnailContainer.querySelectorAll('.thumbnail-card');
    cards.forEach((card, idx) => {
        if (idx === state.currentPageIndex) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            card.classList.remove('active');
        }
    });
}

function updateThumbnailIndices() {
    const cards = els.thumbnailContainer.querySelectorAll('.thumbnail-card');
    cards.forEach((card, idx) => {
        card.querySelector('.thumbnail-index').textContent = `Page ${idx + 1}`;
    });
    updatePageIndicator();
}

// Thumbnail Reordering via SortableJS
let sortableInstance = null;
function setupThumbnailSorting() {
    if (sortableInstance) sortableInstance.destroy();
    
    sortableInstance = Sortable.create(els.thumbnailContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        handle: '.thumbnail-canvas-container',
        onEnd: function(evt) {
            saveHistory();
            const [movedPageId] = state.pageOrder.splice(evt.oldIndex, 1);
            state.pageOrder.splice(evt.newIndex, 0, movedPageId);
            
            // Adjust current index if it moved
            const activeCard = els.thumbnailContainer.querySelector('.thumbnail-card.active');
            if (activeCard) {
                const newActiveIdx = state.pageOrder.indexOf(activeCard.getAttribute('data-page-id'));
                state.currentPageIndex = newActiveIdx;
            }
            
            updateThumbnailIndices();
            renderCurrentPage();
        }
    });
}

// Page manipulations
function rotatePage(pageId, degrees) {
    saveHistory();
    const page = state.pages[pageId];
    page.rotation = (page.rotation + degrees) % 360;
    
    if (pageId === getCurrentPageId()) {
        renderCurrentPage();
    }
    
    // Refresh thumbnail for this card
    const card = els.thumbnailContainer.querySelector(`[data-page-id="${pageId}"]`);
    if (card) {
        const canvas = card.querySelector('canvas');
        renderThumbnailPage(page.originalIndex, page.rotation, canvas);
    }
}

function deletePage(pageId) {
    if (state.pageOrder.length <= 1) {
        showToast('Documents must contain at least 1 page.', 'error');
        return;
    }
    
    saveHistory();
    const idx = state.pageOrder.indexOf(pageId);
    state.pageOrder.splice(idx, 1);
    
    // If deleted the current page or out of index, adjust
    if (state.currentPageIndex >= state.pageOrder.length) {
        state.currentPageIndex = state.pageOrder.length - 1;
    }
    
    deselectAnnotation();
    renderCurrentPage();
    renderThumbnails();
    showToast('Page deleted.');
}

// Redraw non-HTML annotations onto the interactive canvas layer
function redrawAnnotations() {
    const canvas = els.annotationCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const pageId = getCurrentPageId();
    if (!pageId) return;
    
    const annotations = state.pages[pageId].annotations;
    
    annotations.forEach(ann => {
        // Highlight active select state
        const isSelected = state.selectedAnnotation && state.selectedAnnotation.id === ann.id;
        
        if (ann.type === 'draw') {
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.thickness * state.scale;
            ctx.globalAlpha = ann.opacity || 1.0;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo((ann.points[0].x / 100) * canvas.width, (ann.points[0].y / 100) * canvas.height);
            for (let i = 1; i < ann.points.length; i++) {
                ctx.lineTo((ann.points[i].x / 100) * canvas.width, (ann.points[i].y / 100) * canvas.height);
            }
            ctx.stroke();
            
            if (isSelected) {
                // Draw a boundary indicator
                ctx.globalAlpha = 0.25;
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = ann.thickness + 4;
                ctx.stroke();
            }
        }
        else if (ann.type === 'highlight' || ann.type === 'redact') {
            const rx = (ann.x / 100) * canvas.width;
            const ry = (ann.y / 100) * canvas.height;
            const rw = (ann.w / 100) * canvas.width;
            const rh = (ann.h / 100) * canvas.height;
            
            ctx.fillStyle = ann.color;
            ctx.globalAlpha = ann.opacity || 1.0;
            ctx.fillRect(rx, ry, rw, rh);
            
            if (isSelected) {
                // Draw selection border
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1.0;
                ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
                
                // Little corner dots
                ctx.fillStyle = '#a855f7';
                ctx.fillRect(rx - 5, ry - 5, 6, 6);
                ctx.fillRect(rx + rw - 1, ry - 5, 6, 6);
                ctx.fillRect(rx - 5, ry + rh - 1, 6, 6);
                ctx.fillRect(rx + rw - 1, ry + rh - 1, 6, 6);
            }
        }
    });
    
    // Reset globalAlpha
    ctx.globalAlpha = 1.0;
}

// Sync HTML-based text annotations layer
function syncTextAnnotations() {
    els.textOverlayLayer.innerHTML = '';
    const pageId = getCurrentPageId();
    if (!pageId) return;
    
    const annotations = state.pages[pageId].annotations;
    
    annotations.forEach(ann => {
        if (ann.type !== 'text') return;
        
        const textItem = document.createElement('div');
        textItem.className = 'text-annotation-item';
        textItem.setAttribute('data-id', ann.id);
        textItem.setAttribute('data-placeholder', 'Click to type');
        
        textItem.style.left = `${ann.x}%`;
        textItem.style.top = `${ann.y}%`;
        textItem.style.color = ann.color;
        textItem.style.fontSize = `${ann.size * state.scale}px`;
        textItem.style.textAlign = ann.align || 'left';
        textItem.textContent = ann.content;
        
        if (state.selectedAnnotation && state.selectedAnnotation.id === ann.id) {
            textItem.classList.add('selected');
        }
        
        // Double click to edit text contents
        textItem.addEventListener('dblclick', (e) => {
            textItem.contentEditable = true;
            textItem.focus();
            
            // Selection range setup
            const range = document.createRange();
            range.selectNodeContents(textItem);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        
        // Blur ends editing
        textItem.addEventListener('blur', () => {
            textItem.contentEditable = false;
            const textContent = textItem.textContent.trim();
            if (textContent === '') {
                // Remove if empty
                saveHistory();
                const page = state.pages[getCurrentPageId()];
                page.annotations = page.annotations.filter(a => a.id !== ann.id);
                textItem.remove();
                deselectAnnotation();
            } else if (textContent !== ann.content) {
                saveHistory();
                ann.content = textContent;
            }
        });
        
        // Pointer down to select / drag text
        textItem.addEventListener('mousedown', (e) => {
            if (state.activeTool !== 'select') return;
            e.stopPropagation(); // Avoid triggering canvas click selection
            
            selectAnnotation(ann);
            
            state.isDraggingElement = true;
            const pageRect = els.pageContainer.getBoundingClientRect();
            state.dragStartX = ((e.clientX - pageRect.left) / pageRect.width) * 100;
            state.dragStartY = ((e.clientY - pageRect.top) / pageRect.height) * 100;
            state.elemOrigX = ann.x;
            state.elemOrigY = ann.y;
        });
        
        els.textOverlayLayer.appendChild(textItem);
    });
}

// Annotation Interaction and Canvas Mouse Handlers
function handleMouseDown(e) {
    const rect = els.annotationCanvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (state.activeTool === 'select') {
        // Find annotation at click
        const found = getAnnotationAt(clickX, clickY);
        if (found) {
            selectAnnotation(found);
            
            state.isDraggingElement = true;
            state.dragStartX = clickX;
            state.dragStartY = clickY;
            state.elemOrigX = found.x;
            state.elemOrigY = found.y;
            state.elemOrigPoints = found.points ? JSON.parse(JSON.stringify(found.points)) : null;
        } else {
            deselectAnnotation();
        }
    } 
    else if (state.activeTool === 'draw') {
        state.isDrawing = true;
        state.drawPoints = [{ x: clickX, y: clickY }];
    } 
    else if (state.activeTool === 'highlight' || state.activeTool === 'redact') {
        state.isDrawing = true;
        state.startX = clickX;
        state.startY = clickY;
        state.activeRect = { x: clickX, y: clickY, w: 0, h: 0 };
    }
    else if (state.activeTool === 'text') {
        // Spawn text annotation
        saveHistory();
        const pageId = getCurrentPageId();
        const newAnn = {
            id: generateId(),
            type: 'text',
            x: clickX,
            y: clickY,
            color: state.activeColor === '#ffffff' ? '#000000' : state.activeColor, // Default dark for reading comfort unless explicitly altered
            size: state.activeFontSize,
            align: state.activeAlign,
            content: '' // Start empty to allow direct typing
        };
        state.pages[pageId].annotations.push(newAnn);
        
        syncTextAnnotations();
        
        // Immediately double click/focus the text
        setTimeout(() => {
            const addedDiv = els.textOverlayLayer.querySelector(`[data-id="${newAnn.id}"]`);
            if (addedDiv) {
                addedDiv.dispatchEvent(new MouseEvent('dblclick'));
            }
        }, 50);
        
        selectTool('select');
    }
}

function handleMouseMove(e) {
    const rect = els.annotationCanvas.getBoundingClientRect();
    const curX = ((e.clientX - rect.left) / rect.width) * 100;
    const curY = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (state.isDrawing) {
        const ctx = els.annotationCanvas.getContext('2d');
        
        if (state.activeTool === 'draw') {
            state.drawPoints.push({ x: curX, y: curY });
            
            // Immediate sketch lines
            redrawAnnotations();
            ctx.strokeStyle = state.activeColor;
            ctx.lineWidth = state.activeThickness * state.scale;
            ctx.globalAlpha = state.activeOpacity / 100;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo((state.drawPoints[0].x / 100) * els.annotationCanvas.width, (state.drawPoints[0].y / 100) * els.annotationCanvas.height);
            for (let i = 1; i < state.drawPoints.length; i++) {
                ctx.lineTo((state.drawPoints[i].x / 100) * els.annotationCanvas.width, (state.drawPoints[i].y / 100) * els.annotationCanvas.height);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } 
        else if (state.activeTool === 'highlight' || state.activeTool === 'redact') {
            state.activeRect.x = Math.min(state.startX, curX);
            state.activeRect.y = Math.min(state.startY, curY);
            state.activeRect.w = Math.abs(state.startX - curX);
            state.activeRect.h = Math.abs(state.startY - curY);
            
            redrawAnnotations();
            
            ctx.fillStyle = state.activeTool === 'redact' ? '#000000' : state.activeColor;
            ctx.globalAlpha = state.activeTool === 'redact' ? 1.0 : 0.4;
            ctx.fillRect(
                (state.activeRect.x / 100) * els.annotationCanvas.width,
                (state.activeRect.y / 100) * els.annotationCanvas.height,
                (state.activeRect.w / 100) * els.annotationCanvas.width,
                (state.activeRect.h / 100) * els.annotationCanvas.height
            );
            ctx.globalAlpha = 1.0;
        }
    } 
    else if (state.isDraggingElement && state.selectedAnnotation) {
        const dx = curX - state.dragStartX;
        const dy = curY - state.dragStartY;
        
        if (state.selectedAnnotation.type === 'draw') {
            state.selectedAnnotation.points = state.elemOrigPoints.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        } else {
            state.selectedAnnotation.x = state.elemOrigX + dx;
            state.selectedAnnotation.y = state.elemOrigY + dy;
        }
        
        redrawAnnotations();
        syncTextAnnotations();
    }
}

function handleMouseUp(e) {
    if (state.isDrawing) {
        state.isDrawing = false;
        
        if (state.activeTool === 'draw' && state.drawPoints.length > 1) {
            saveHistory();
            const page = state.pages[getCurrentPageId()];
            page.annotations.push({
                id: generateId(),
                type: 'draw',
                points: state.drawPoints,
                color: state.activeColor,
                thickness: state.activeThickness,
                opacity: state.activeOpacity / 100
            });
        } 
        else if ((state.activeTool === 'highlight' || state.activeTool === 'redact') && state.activeRect && state.activeRect.w > 0.5 && state.activeRect.h > 0.5) {
            saveHistory();
            const page = state.pages[getCurrentPageId()];
            page.annotations.push({
                id: generateId(),
                type: state.activeTool,
                x: state.activeRect.x,
                y: state.activeRect.y,
                w: state.activeRect.w,
                h: state.activeRect.h,
                color: state.activeTool === 'redact' ? '#000000' : state.activeColor,
                opacity: state.activeTool === 'redact' ? 1.0 : 0.4
            });
        }
        
        state.drawPoints = [];
        state.activeRect = null;
        redrawAnnotations();
        syncTextAnnotations();
    } 
    else if (state.isDraggingElement) {
        state.isDraggingElement = false;
        saveHistory();
    }
}

// Click detection algorithm
function getAnnotationAt(x, y) {
    const pageId = getCurrentPageId();
    if (!pageId) return null;
    const annotations = state.pages[pageId].annotations;
    
    // Check backwards to grab top elements first
    for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        
        if (ann.type === 'highlight' || ann.type === 'redact' || ann.type === 'text') {
            // Check bounding box
            const w = ann.w || 8; // Estimate text width if missing
            const h = ann.h || 4;
            if (x >= ann.x && x <= ann.x + w && y >= ann.y && y <= ann.y + h) {
                return ann;
            }
        } 
        else if (ann.type === 'draw') {
            // Check closeness to any line segment
            for (let j = 0; j < ann.points.length - 1; j++) {
                const p1 = ann.points[j];
                const p2 = ann.points[j+1];
                const dist = pointToSeqDistance(x, y, p1.x, p1.y, p2.x, p2.y);
                if (dist < 1.5) { // Threshold in percentages
                    return ann;
                }
            }
        }
    }
    return null;
}

// Helper distance math
function pointToSeqDistance(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Property Modifications
function selectAnnotation(ann) {
    state.selectedAnnotation = ann;
    updateInspector();
    redrawAnnotations();
    syncTextAnnotations();
}

function deselectAnnotation() {
    state.selectedAnnotation = null;
    updateInspector();
    redrawAnnotations();
    syncTextAnnotations();
}

function updateSelectedAnnotationProperty(prop, value) {
    if (!state.selectedAnnotation) return;
    
    saveHistory();
    state.selectedAnnotation[prop] = value;
    redrawAnnotations();
    syncTextAnnotations();
}

function deleteSelectedAnnotation() {
    if (!state.selectedAnnotation) return;
    
    saveHistory();
    const page = state.pages[getCurrentPageId()];
    page.annotations = page.annotations.filter(a => a.id !== state.selectedAnnotation.id);
    deselectAnnotation();
    showToast('Annotation deleted.');
}

// Inspector View Synchronization
function updateInspector() {
    if (!state.selectedAnnotation) {
        els.inspectorEmptyMsg.style.display = 'flex';
        els.inspectorSectionProps.style.display = 'none';
        els.rightSidebar.classList.add('collapsed');
        return;
    }
    
    els.inspectorEmptyMsg.style.display = 'none';
    els.inspectorSectionProps.style.display = 'block';
    els.rightSidebar.classList.remove('collapsed');
    
    const ann = state.selectedAnnotation;
    
    // Toggle relevant control fields
    if (ann.type === 'text') {
        document.getElementById('group-font-size').style.display = 'block';
        document.getElementById('group-alignment').style.display = 'block';
        document.getElementById('group-opacity').style.display = 'none';
        document.getElementById('group-thickness').style.display = 'none';
        els.redactSecurityWarning.style.display = 'none';
        
        els.propFontSize.value = ann.size;
        els.lblFontSize.textContent = `${ann.size}px`;
        
        els.segBtns.forEach(b => {
            if (b.getAttribute('data-align') === (ann.align || 'left')) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
    } 
    else if (ann.type === 'draw') {
        document.getElementById('group-font-size').style.display = 'none';
        document.getElementById('group-alignment').style.display = 'none';
        document.getElementById('group-opacity').style.display = 'block';
        document.getElementById('group-thickness').style.display = 'block';
        els.redactSecurityWarning.style.display = 'none';
        
        els.propThickness.value = ann.thickness;
        els.lblThickness.textContent = `${ann.thickness}px`;
        els.propOpacity.value = Math.round(ann.opacity * 100);
        els.lblOpacity.textContent = `${Math.round(ann.opacity * 100)}%`;
    } 
    else if (ann.type === 'highlight') {
        document.getElementById('group-font-size').style.display = 'none';
        document.getElementById('group-alignment').style.display = 'none';
        document.getElementById('group-opacity').style.display = 'block';
        document.getElementById('group-thickness').style.display = 'none';
        els.redactSecurityWarning.style.display = 'none';
        
        els.propOpacity.value = Math.round(ann.opacity * 100);
        els.lblOpacity.textContent = `${Math.round(ann.opacity * 100)}%`;
    }
    else if (ann.type === 'redact') {
        document.getElementById('group-font-size').style.display = 'none';
        document.getElementById('group-alignment').style.display = 'none';
        document.getElementById('group-opacity').style.display = 'none';
        document.getElementById('group-thickness').style.display = 'none';
        els.redactSecurityWarning.style.display = 'block';
    }
    
    // Highlight swatch color matches
    els.colorSwatches.forEach(s => {
        if (s.getAttribute('data-color') === ann.color) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
}

// History stack operations
function saveHistory() {
    // Save current pages and pageOrder state
    const snapshot = JSON.stringify({
        pages: state.pages,
        pageOrder: state.pageOrder,
        currentPageIndex: state.currentPageIndex
    });
    
    state.undoStack.push(snapshot);
    state.redoStack = []; // Clear redo stack on new action
    
    // Cap history size to 30 steps
    if (state.undoStack.length > 30) {
        state.undoStack.shift();
    }
    
    updateUndoRedoButtons();
}

function undo() {
    if (state.undoStack.length === 0) return;
    
    // Current state snapshot for Redo
    const currentSnapshot = JSON.stringify({
        pages: state.pages,
        pageOrder: state.pageOrder,
        currentPageIndex: state.currentPageIndex
    });
    state.redoStack.push(currentSnapshot);
    
    // Restore past
    const pastSnapshot = JSON.parse(state.undoStack.pop());
    state.pages = pastSnapshot.pages;
    state.pageOrder = pastSnapshot.pageOrder;
    state.currentPageIndex = pastSnapshot.currentPageIndex;
    
    deselectAnnotation();
    renderCurrentPage();
    renderThumbnails();
    updateUndoRedoButtons();
    showToast('Undo action applied.', 'info');
}

function redo() {
    if (state.redoStack.length === 0) return;
    
    // Current state snapshot for Undo
    const currentSnapshot = JSON.stringify({
        pages: state.pages,
        pageOrder: state.pageOrder,
        currentPageIndex: state.currentPageIndex
    });
    state.undoStack.push(currentSnapshot);
    
    // Restore future
    const futureSnapshot = JSON.parse(state.redoStack.pop());
    state.pages = futureSnapshot.pages;
    state.pageOrder = futureSnapshot.pageOrder;
    state.currentPageIndex = futureSnapshot.currentPageIndex;
    
    deselectAnnotation();
    renderCurrentPage();
    renderThumbnails();
    updateUndoRedoButtons();
    showToast('Redo action applied.', 'info');
}

function updateUndoRedoButtons() {
    els.btnUndo.disabled = state.undoStack.length === 0;
    els.btnRedo.disabled = state.redoStack.length === 0;
}

// PDF EXPORT CHANNELS
async function doExport(flatten = false) {
    if (!state.pdfBytes) return;
    
    showLoading(flatten ? 'Generating Secure Flattened PDF (re-rasterizing pages)...' : 'Compiling Standard PDF with overlays...');
    
    try {
        let exportBytes;
        
        if (flatten) {
            exportBytes = await exportFlattenedPDF();
        } else {
            exportBytes = await exportStandardPDF();
        }
        
        // Trigger download
        const blob = new Blob([exportBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const baseName = state.fileName.replace('.pdf', '');
        const suffix = flatten ? '_redacted_secure.pdf' : '_edited.pdf';
        
        link.href = url;
        link.download = `${baseName}${suffix}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Document exported as ${baseName}${suffix}!`);
    } catch (err) {
        console.error(err);
        showToast('Export failed. Check console.', 'error');
    } finally {
        hideLoading();
    }
}

// EXPORT 1: Standard PDF-Lib overlays
async function exportStandardPDF() {
    // Load the original document
    const srcDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
    const exportDoc = await PDFLib.PDFDocument.create();
    
    // Copy the pages in reordered sequence
    const indicesToCopy = state.pageOrder.map(pageId => state.pages[pageId].originalIndex);
    const copiedPages = await exportDoc.copyPages(srcDoc, indicesToCopy);
    
    const helveticaFont = await exportDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    
    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const pageId = state.pageOrder[i];
        const pageData = state.pages[pageId];
        
        // Apply page rotations
        page.setRotation(PDFLib.degrees(pageData.rotation));
        
        const { width, height } = page.getSize();
        const annotations = pageData.annotations;
        
        for (const ann of annotations) {
            const rot = pageData.rotation;
            
            if (ann.type === 'highlight' || ann.type === 'redact') {
                const rectBounds = mapBrowserRectToPDFRect(ann.x, ann.y, ann.w, ann.h, width, height, rot);
                const colorRGB = hexToRGB(ann.color);
                
                page.drawRectangle({
                    x: rectBounds.x,
                    y: rectBounds.y,
                    width: rectBounds.w,
                    height: rectBounds.h,
                    color: PDFLib.rgb(colorRGB.r, colorRGB.g, colorRGB.b),
                    opacity: ann.opacity
                });
            } 
            else if (ann.type === 'draw') {
                const colorRGB = hexToRGB(ann.color);
                const pdfColor = PDFLib.rgb(colorRGB.r, colorRGB.g, colorRGB.b);
                const thickness = ann.thickness * 0.75; // scale down thickness slightly for original size alignment
                
                // Draw lines between consecutive path points
                for (let j = 0; j < ann.points.length - 1; j++) {
                    const p1 = mapBrowserPointToPDF(ann.points[j].x, ann.points[j].y, width, height, rot);
                    const p2 = mapBrowserPointToPDF(ann.points[j+1].x, ann.points[j+1].y, width, height, rot);
                    
                    page.drawLine({
                        start: { x: p1.x, y: p1.y },
                        end: { x: p2.x, y: p2.y },
                        thickness: thickness,
                        color: pdfColor,
                        opacity: ann.opacity || 1.0
                    });
                }
            }
            else if (ann.type === 'text') {
                const colorRGB = hexToRGB(ann.color);
                const textPos = mapBrowserPointToPDF(ann.x, ann.y, width, height, rot);
                
                // Adjust text size based on scale conversion
                // Standard default scale page width is typically 595.27 points (A4)
                const baseTextSize = ann.size * (width / 612); // Adjust text size relative to width scale ratio
                
                // Offset baseline down so top-left aligns nicely
                const offsetTextPos = {
                    x: textPos.x,
                    y: textPos.y - baseTextSize
                };
                
                page.drawText(ann.content, {
                    x: offsetTextPos.x,
                    y: offsetTextPos.y,
                    size: baseTextSize,
                    font: helveticaFont,
                    color: PDFLib.rgb(colorRGB.r, colorRGB.g, colorRGB.b)
                });
            }
        }
        
        exportDoc.addPage(page);
    }
    
    return await exportDoc.save();
}

// EXPORT 2: Secure Rasterized Flattened PDF
async function exportFlattenedPDF() {
    const exportDoc = await PDFLib.PDFDocument.create();
    
    for (let i = 0; i < state.pageOrder.length; i++) {
        const pageId = state.pageOrder[i];
        const pageData = state.pages[pageId];
        
        // Step 1: Render original PDF page at 2.0x scale onto canvas
        const page = await state.pdfJS.getPage(pageData.originalIndex + 1);
        const renderScale = 2.0; // High resolution for reading quality (144 DPI)
        const viewport = page.getViewport({ scale: renderScale, rotation: pageData.rotation });
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const ctx = tempCanvas.getContext('2d');
        
        // Render background PDF page
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        // Step 2: Overlay all drawings, highlights, and redactions on top of this high-res canvas
        const annotations = pageData.annotations;
        annotations.forEach(ann => {
            if (ann.type === 'draw') {
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = ann.thickness * renderScale;
                ctx.globalAlpha = ann.opacity || 1.0;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.beginPath();
                ctx.moveTo((ann.points[0].x / 100) * tempCanvas.width, (ann.points[0].y / 100) * tempCanvas.height);
                for (let j = 1; j < ann.points.length; j++) {
                    ctx.lineTo((ann.points[j].x / 100) * tempCanvas.width, (ann.points[j].y / 100) * tempCanvas.height);
                }
                ctx.stroke();
            }
            else if (ann.type === 'highlight' || ann.type === 'redact') {
                ctx.fillStyle = ann.color;
                ctx.globalAlpha = ann.opacity || 1.0;
                ctx.fillRect(
                    (ann.x / 100) * tempCanvas.width,
                    (ann.y / 100) * tempCanvas.height,
                    (ann.w / 100) * tempCanvas.width,
                    (ann.h / 100) * tempCanvas.height
                );
            }
            else if (ann.type === 'text') {
                ctx.fillStyle = ann.color;
                ctx.globalAlpha = 1.0;
                // Font size conversion
                const canvasFontSize = ann.size * (tempCanvas.width / 612); // Adjust relative to canvas width
                ctx.font = `500 ${canvasFontSize}px Inter, Helvetica, sans-serif`;
                ctx.textAlign = ann.align || 'left';
                ctx.textBaseline = 'top';
                
                const tx = (ann.x / 100) * tempCanvas.width;
                const ty = (ann.y / 100) * tempCanvas.height;
                
                ctx.fillText(ann.content, tx, ty);
            }
        });
        ctx.globalAlpha = 1.0; // Reset
        
        // Step 3: Extract rasterized canvas image (JPEG)
        // High quality JPEG compression (0.92) to keep files reasonably sized but crisp
        const imgDataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
        
        // Step 4: Add blank page with original dimensions to pdf-lib and draw raster image
        const origViewport = page.getViewport({ scale: 1.0, rotation: pageData.rotation });
        const newPage = exportDoc.addPage([origViewport.width, origViewport.height]);
        
        const embedImg = await exportDoc.embedJpg(imgDataUrl);
        newPage.drawImage(embedImg, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height
        });
    }
    
    return await exportDoc.save();
}

// Point mapping conversion utility
function mapBrowserPointToPDF(xPct, yPct, pdfWidth, pdfHeight, rotation) {
    const x = xPct / 100;
    const y = yPct / 100;
    
    switch (rotation) {
        case 0:
            return {
                x: x * pdfWidth,
                y: (1 - y) * pdfHeight
            };
        case 90:
            return {
                x: y * pdfWidth,
                y: x * pdfHeight
            };
        case 180:
            return {
                x: (1 - x) * pdfWidth,
                y: y * pdfHeight
            };
        case 270:
            return {
                x: (1 - y) * pdfWidth,
                y: (1 - x) * pdfHeight
            };
        default:
            return { x: x * pdfWidth, y: (1 - y) * pdfHeight };
    }
}

// Bounding box mapping conversion utility
function mapBrowserRectToPDFRect(xPct, yPct, wPct, hPct, pdfWidth, pdfHeight, rotation) {
    const x = xPct / 100;
    const y = yPct / 100;
    const w = wPct / 100;
    const h = hPct / 100;
    
    switch (rotation) {
        case 0:
            return {
                x: x * pdfWidth,
                y: (1 - y - h) * pdfHeight,
                w: w * pdfWidth,
                h: h * pdfHeight
            };
        case 90:
            // Swapped width & height in coordinates mapping
            return {
                x: y * pdfWidth,
                y: x * pdfHeight,
                w: h * pdfWidth,
                h: w * pdfHeight
            };
        case 180:
            return {
                x: (1 - x - w) * pdfWidth,
                y: (1 - y - h) * pdfHeight,
                w: w * pdfWidth,
                h: h * pdfHeight
            };
        case 270:
            // Swapped width & height
            return {
                x: (1 - y - h) * pdfWidth,
                y: (1 - x - w) * pdfHeight,
                w: h * pdfWidth,
                h: w * pdfHeight
            };
        default:
            return {
                x: x * pdfWidth,
                y: (1 - y - h) * pdfHeight,
                w: w * pdfWidth,
                h: h * pdfHeight
            };
    }
}

// Helpers
function generateId() {
    return `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function hexToRGB(hex) {
    // If transparent/none or invalid, return default
    if (!hex || hex.startsWith('rgba')) return { r: 0, g: 0, b: 0 };
    
    let c = hex.substring(1);
    let rgb = parseInt(c, 16);
    return {
        r: ((rgb >> 16) & 0xff) / 255,
        g: ((rgb >> 8) & 0xff) / 255,
        b: (rgb & 0xff) / 255
    };
}
