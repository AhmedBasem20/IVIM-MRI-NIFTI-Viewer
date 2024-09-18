import * as nifti from 'nifti-reader-js';

// Get the canvas elements
const canvases = {
  axial: document.getElementById('axial-canvas'),
  coronal: document.getElementById('coronal-canvas'),
  sagittal: document.getElementById('sagittal-canvas'),
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

      if (header.datatypeCode === nifti.NIFTI1.TYPE_FLOAT64) {
        // FLOAT64
        niftiImage = new Float64Array(imageBuffer);
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_FLOAT32) {
        // FLOAT32
        niftiImage = new Float32Array(imageBuffer);
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_INT16) {
        // INT16
        niftiImage = new Int16Array(imageBuffer);
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_UINT16) {
        // UINT16
        niftiImage = new Uint16Array(imageBuffer);
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
      const data = nifti.isCompressed(arrayBuffer)
        ? nifti.decompress(arrayBuffer)
        : arrayBuffer;
      resolve(data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

function renderNiftiImage(header, niftiImage) {
  const dims = header.dims;
  const nx = dims[1]; // X dimension
  const ny = dims[2]; // Y dimension
  const nz = dims[3]; // Z dimension
  const nt = dims[4] || 1; // Time dimension

  // Update canvas sizes to match the image dimensions
  canvases.axial.width = nx;
  canvases.axial.height = ny;
  canvases.coronal.width = nx;
  canvases.coronal.height = nz;
  canvases.sagittal.width = ny;
  canvases.sagittal.height = nz;

  // Compute the middle indices for each axis
  const axialSliceIndex = Math.floor(nz / 2);
  const coronalSliceIndex = Math.floor(ny / 2);
  const sagittalSliceIndex = Math.floor(nx / 2);

  // Render axial slice
  renderAxialSlice(canvases.axial, header, niftiImage, axialSliceIndex);

  // Render coronal slice
  renderCoronalSlice(canvases.coronal, header, niftiImage, coronalSliceIndex);

  // Render sagittal slice
  renderSagittalSlice(
    canvases.sagittal,
    header,
    niftiImage,
    sagittalSliceIndex
  );

  // Add event listeners for voxel selection
  canvases.axial.addEventListener('click', (event) =>
    handleVoxelClick(event, header, niftiImage, 'axial')
  );
  canvases.coronal.addEventListener('click', (event) =>
    handleVoxelClick(event, header, niftiImage, 'coronal')
  );
  canvases.sagittal.addEventListener('click', (event) =>
    handleVoxelClick(event, header, niftiImage, 'sagittal')
  );
}

function renderAxialSlice(canvas, header, niftiImage, sliceIndex) {
  const context = canvas.getContext('2d');
  const nx = header.dims[1];
  const ny = header.dims[2];
  const nz = header.dims[3];
  const nt = header.dims[4] || 1;

  const sliceSize = nx * ny;
  const volumeSize = sliceSize * nz;

  const t = 0; // Time index (first volume)

  const offset = t * volumeSize + sliceIndex * sliceSize;
  const sliceData = niftiImage.slice(offset, offset + sliceSize);

  renderSlice(context, sliceData, nx, ny);
}

function renderCoronalSlice(canvas, header, niftiImage, sliceIndex) {
  const context = canvas.getContext('2d');
  const nx = header.dims[1];
  const ny = header.dims[2];
  const nz = header.dims[3];
  const nt = header.dims[4] || 1;

  const sliceData = new Float32Array(nx * nz);

  const volumeSize = nx * ny * nz;
  const t = 0;

  // For each depth (z) and width (x)
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      const voxelIndex =
        x +
        sliceIndex * nx +
        z * nx * ny +
        t * volumeSize; // x + y*nx + z*nx*ny + t*nx*ny*nz
      const dataIndex = x + z * nx; // x + z*nx
      sliceData[dataIndex] = niftiImage[voxelIndex];
    }
  }

  renderSlice(context, sliceData, nx, nz);
}

function renderSagittalSlice(canvas, header, niftiImage, sliceIndex) {
  const context = canvas.getContext('2d');
  const nx = header.dims[1];
  const ny = header.dims[2];
  const nz = header.dims[3];
  const nt = header.dims[4] || 1;

  const sliceData = new Float32Array(ny * nz);

  const volumeSize = nx * ny * nz;
  const t = 0;

  // For each depth (z) and height (y)
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      const voxelIndex =
        sliceIndex +
        y * nx +
        z * nx * ny +
        t * volumeSize; // x + y*nx + z*nx*ny + t*nx*ny*nz
      const dataIndex = y + z * ny; // y + z*ny
      sliceData[dataIndex] = niftiImage[voxelIndex];
    }
  }

  renderSlice(context, sliceData, ny, nz);
}

function renderSlice(context, sliceData, width, height) {
  const imageData = context.createImageData(width, height);

  const { min, max } = getMinMax(sliceData);

  for (let i = 0; i < sliceData.length; i++) {
    const value = Math.floor((255 * (sliceData[i] - min)) / (max - min));

    imageData.data[4 * i] = value; // Red
    imageData.data[4 * i + 1] = value; // Green
    imageData.data[4 * i + 2] = value; // Blue
    imageData.data[4 * i + 3] = 255; // Alpha
  }

  context.putImageData(imageData, 0, 0);
}

function getMinMax(data) {
  let min = data[0];
  let max = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  return { min, max };
}

function handleVoxelClick(event, header, niftiImage, view) {
  const canvas = event.target;
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  const dims = header.dims;
  const nx = dims[1];
  const ny = dims[2];
  const nz = dims[3];
  const nt = dims[4] || 1;

  let voxelX, voxelY, voxelZ;

  if (view === 'axial') {
    // x maps to x, y maps to y, z is constant
    voxelX = Math.floor((clickX / canvas.width) * nx);
    voxelY = Math.floor((clickY / canvas.height) * ny);
    voxelZ = Math.floor(nz / 2); // axial slice index
  } else if (view === 'coronal') {
    // x maps to x, y maps to z, y is constant
    voxelX = Math.floor((clickX / canvas.width) * nx);
    voxelY = Math.floor(ny / 2); // coronal slice index
    voxelZ = Math.floor((clickY / canvas.height) * nz);
  } else if (view === 'sagittal') {
    // x maps to y, y maps to z, x is constant
    voxelX = Math.floor(nx / 2); // sagittal slice index
    voxelY = Math.floor((clickX / canvas.width) * ny);
    voxelZ = Math.floor((clickY / canvas.height) * nz);
  }

  // Ensure voxel indices are within bounds
  voxelX = Math.min(Math.max(voxelX, 0), nx - 1);
  voxelY = Math.min(Math.max(voxelY, 0), ny - 1);
  voxelZ = Math.min(Math.max(voxelZ, 0), nz - 1);

  // Now extract the voxel values across all time points
  const sliceSize = nx * ny;
  const volumeSize = sliceSize * nz;
  let voxelValues = [];

  for (let t = 0; t < nt; t++) {
    const voxelIndex =
      voxelX + voxelY * nx + voxelZ * nx * ny + t * volumeSize;
    voxelValues.push(niftiImage[voxelIndex]);
  }

  voxelInfo.innerText = `Voxel [${voxelX}, ${voxelY}, ${voxelZ}]: Values: ${voxelValues.join(
    ', '
  )}`;

  plotVoxelData(voxelValues);
}

function plotVoxelData(values) {
  // Adjust b-values according to your data
  const bValues = [
    0.0, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 250.0,
    350.0, 400.0, 550.0, 700.0, 850.0, 1000.0, 1150.0, 1300.0,
  ];

  // Ensure the length of bValues matches the length of values
  const xValues =
    bValues.length === values.length
      ? bValues
      : Array.from({ length: values.length }, (_, i) => i);

  const trace = {
    x: xValues,
    y: values,
    mode: 'markers',
    type: 'scatter',
  };

  const layout = {
    title: 'Voxel Intensity vs. B-Values',
    xaxis: { title: 'B-Values' },
    yaxis: { title: 'Intensity' },
  };

  Plotly.newPlot('plot', [trace], layout);
}
