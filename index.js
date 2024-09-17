import * as nifti from 'nifti-reader-js';

const canvases = {
    original: document.getElementById('original-canvas')
};
const voxelInfo = document.getElementById('voxel-info');
const niftiInput = document.getElementById('nifti-file-input');

// Listen for file upload
niftiInput.addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const data = await loadNiftiFile(file);
        if (!data) {
            console.error('Failed to load file');
            return;
        }

        try {
            const header = nifti.readHeader(data);
            const imageBuffer = nifti.readImage(header, data);
            let niftiImage;

            if (header.datatypeCode === 64) { // FLOAT64
                niftiImage = new Float64Array(imageBuffer);
            } else {
                console.error('Unsupported datatype', header.datatypeCode);
                return;
            }

            console.log('Header:', header);
            console.log('Image data length:', niftiImage.length);

            renderNiftiImage(header, niftiImage);
        } catch (error) {
            console.error('Error processing file:', error);
        }
    }
}

async function loadNiftiFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target.result;
            const data = nifti.isCompressed(arrayBuffer) ? nifti.decompress(arrayBuffer) : arrayBuffer;
            resolve(data);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

function renderNiftiImage(header, niftiImage) {
    const context = canvases.original.getContext('2d');
    const width = header.dims[1];
    const height = header.dims[2];
    const sliceIndex = Math.floor(header.dims[3] / 2);
    const sliceData = niftiImage.slice(sliceIndex * width * height, (sliceIndex + 1) * width * height);

    renderSlice(context, sliceData, width, height);

    canvases.original.addEventListener('click', (event) => handleVoxelClick(niftiImage, event, header));
}

function renderSlice(context, sliceData, width, height) {
    const imageData = context.createImageData(width, height);
    console.log('slice data:', sliceData);

    for (let i = 0; i < sliceData.length; i++) {
        const value = Math.floor(255 * (sliceData[i] - Math.min(...sliceData)) / (Math.max(...sliceData) - Math.min(...sliceData)));

        imageData.data[4 * i] = value;     // Red
        imageData.data[4 * i + 1] = value; // Green
        imageData.data[4 * i + 2] = value; // Blue
        imageData.data[4 * i + 3] = 255;   // Alpha
    }
    context.putImageData(imageData, 0, 0);
}

function handleVoxelClick(niftiImage, event, header) {
    const canvas = event.target;
    const x = event.offsetX;
    const y = event.offsetY;

    const voxelX = Math.floor(x / canvas.width * header.dims[1]);
    const voxelY = Math.floor(y / canvas.height * header.dims[2]);
    const voxelZ = Math.floor(header.dims[3] / 2);

    const sliceSize = header.dims[1] * header.dims[2];
    let originalVal = [];

    for (let t = 0; t < header.dims[4]; t++) {
        const voxelIndex = voxelX + voxelY * header.dims[1] + voxelZ * sliceSize + t * sliceSize * header.dims[3];
        originalVal.push(niftiImage[voxelIndex]);
    }

    voxelInfo.innerText = `Voxel [${voxelX}, ${voxelY}, ${voxelZ}]: Original: ${originalVal[0]}`;
    plotVoxelData(originalVal);
}

function plotVoxelData(original) {
    const bValues = [0.0, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 250.0, 350.0, 400.0, 550.0, 700.0, 850.0, 1000.0];

    const trace = {
        x: bValues,
        y: original,
        mode: 'markers',
        type: 'scatter'
    };

    const layout = {
        title: 'Voxel Parameter Maps',
        xaxis: { title: 'B-Values' },
        yaxis: { title: 'Intensity' }
    };

    Plotly.newPlot('plot', [trace], layout);
}
