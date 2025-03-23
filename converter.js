const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });
let conversionResult = null;

// Initialize FFmpeg
(async () => {
    await ffmpeg.load();
})();

async function convertFile() {
    const file = document.getElementById('fileInput').files[0];
    const format = document.getElementById('formatSelect').value;
    const loading = document.getElementById('loading');
    const downloadSection = document.getElementById('downloadSection');
    const previewContainer = document.getElementById('previewContainer');
    const errorContainer = document.getElementById('errorContainer');

    // Reset UI
    previewContainer.innerHTML = '';
    downloadSection.style.display = 'none';
    errorContainer.style.display = 'none';
    conversionResult = null;

    if (!file) {
        showError('Please select a file first!');
        return;
    }

    try {
        loading.style.display = 'flex';
        let result;

        switch(format) {
            case 'pdf2jpg':
                result = await convertPDFtoJPG(file);
                break;
            case 'pdf2word':
                result = await convertPDFtoWord(file);
                break;
            case 'word2pdf':
                result = await convertWordToPDF(file);
                break;
            case 'mp4tomp3':
                result = await convertMP4toMP3(file);
                break;
            default:
                throw new Error('Invalid conversion format');
        }

        conversionResult = result;
        showPreview(result, format);
        downloadSection.style.display = 'block';
    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = 'none';
    }
}

async function convertPDFtoJPG(pdfFile) {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const zip = new JSZip();
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');
        zip.file(`page-${i + 1}.jpg`, base64Data, { base64: true });
    }
    
    return await zip.generateAsync({ type: 'blob' });
}

async function convertPDFtoWord(pdfFile) {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const textContent = (await Promise.all(
        pdfDoc.getPages().map(async (page) => {
            const text = await page.getTextContent();
            return text.items.map(item => item.str).join(' ');
        })
    )).join('\n\n');
    
    return new Blob([textContent], { type: 'application/msword' });
}

async function convertWordToPDF(wordFile) {
    const arrayBuffer = await wordFile.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    const doc = new jspdf.jsPDF();
    await doc.html(result.value, {
        margin: [15, 15, 15, 15],
        autoPaging: 'text',
        callback: (doc) => doc.output('blob')
    });
}

async function convertMP4toMP3(mp4File) {
    const inputName = 'input.mp4';
    const outputName = 'output.mp3';
    
    ffmpeg.FS('writeFile', inputName, new Uint8Array(await mp4File.arrayBuffer()));
    await ffmpeg.run('-i', inputName, '-q:a', '0', '-map', 'a', outputName);
    
    const data = ffmpeg.FS('readFile', outputName);
    return new Blob([data.buffer], { type: 'audio/mpeg' });
}

function showPreview(result, format) {
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';

    if (format === 'pdf2jpg') {
        previewContainer.innerHTML = `<p>${result instanceof Blob ? 'ZIP containing JPG images' : 'Preview not available'}</p>`;
    } else if (format === 'mp4tomp3') {
        const url = URL.createObjectURL(result);
        previewContainer.innerHTML = `
            <audio controls class="preview-item">
                <source src="${url}" type="audio/mpeg">
                Your browser does not support audio preview.
            </audio>
        `;
    } else if (format === 'word2pdf') {
        const url = URL.createObjectURL(result);
        previewContainer.innerHTML = `
            <embed class="preview-item" src="${url}" type="application/pdf" width="100%" height="400px">
        `;
    } else if (format === 'pdf2word') {
        const url = URL.createObjectURL(result);
        previewContainer.innerHTML = `
            <iframe class="preview-item" src="${url}" style="width:100%; height:400px"></iframe>
        `;
    }
}

function downloadFile() {
    if (!conversionResult) return;
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(conversionResult);
    a.download = `converted-file.${getFileExtension()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function getFileExtension() {
    const format = document.getElementById('formatSelect').value;
    const extensions = {
        'pdf2jpg': 'zip',
        'pdf2word': 'doc',
        'word2pdf': 'pdf',
        'mp4tomp3': 'mp3'
    };
    return extensions[format] || 'file';
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `Error: ${message}`;
    errorContainer.style.display = 'block';
}
