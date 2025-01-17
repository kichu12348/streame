self.onmessage = async (e) => {
    // Checking if im gonnna be killed 💀
    if (e.data.cleanup) {
        console.log("goodbye cruel world....");
        self.close();
        return;
    }

    const { file, chunkSize, type, additionalData, chunkIndex, totalChunks } = e.data;
    
    try {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end); // The slice of life... or data
        
        // Package the remains
        const formData = new FormData();
        formData.append('file', chunk, file.name); // Another piece for the collection
        formData.append('chunkIndex', chunkIndex); // Marking the victims
        formData.append('totalChunks', totalChunks);
        formData.append('type', type);
        
        // Bury the evidence with the rest of the metadata
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value); // Another secret for the grave
        });

        const response = await fetch('/api/upload-chunk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server rejected our offering! Status: ${response.status}`);
        }

        // Report back to the mothersh-- er, main thread
        self.postMessage({ 
            success: true, 
            chunkIndex, 
            fileId: additionalData.fileId 
        });
    } catch (error) {
        // i think im dying.... hhhheelp--..... ded
        self.postMessage({ 
            success: false, 
            chunkIndex,
            error: `Failed to process chunk #${chunkIndex}. It's dead, Jim. Cause: ${error.message} we couldn't save it. RIP.`,
            fileId: additionalData.fileId 
        });
    }
};