self.onmessage = async (e) => {
    const { file, chunkSize, type, additionalData, chunkIndex, totalChunks } = e.data;
    
    try {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        formData.append('file', chunk, file.name);
        formData.append('chunkIndex', chunkIndex);
        formData.append('totalChunks', totalChunks);
        formData.append('type', type);
        
        // Add all additional data
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const response = await fetch('/api/upload-chunk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        self.postMessage({ success: true, chunkIndex, fileId: additionalData.fileId });
    } catch (error) {
        self.postMessage({ 
            success: false, 
            chunkIndex, 
            error: error.message,
            fileId: additionalData.fileId 
        });
    }
};