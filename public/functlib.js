export function MessageBox(message, buttons, alertMessage='Alert Message', backColor='whitesmoke', placeTop=false) {
    return new Promise((resolve) => {
        // Disable background scrolling
        document.body.style.overflow = 'hidden';        

        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = placeTop ? '' : 'rgba(0, 0, 0, 0.1)';
        overlay.style.zIndex = '1000';

        // Create modal
        const modal = document.createElement('div');
        modal.style.position = 'absolute';
        modal.style.top =  placeTop ? '0' : '50%';
        modal.style.left = '50%';
        modal.style.maxWidth = '600px';
        modal.style.transform = placeTop ? 'translate(-50%)' : 'translate(-50%, -50%)';
        modal.style.backgroundColor = backColor;
        modal.style.padding = '0';
        modal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        modal.style.borderRadius = '5px';
        modal.style.fontFamily = "Tahoma, Lucida Console";
        modal.style.flexWrap = "wrap";

        // Create Title Bar
        const titleBar = document.createElement('div');
        titleBar.style.display = 'flex'; 
        // titleBar.style.justifyContent = 'center'; 
        titleBar.style.alignItems = 'center'; 
        titleBar.style.width="auto" ;
        titleBar.style.height="30px" ;
        titleBar.style.color = "white" ;
        titleBar.style.backgroundColor = 'var(--main-bg-color)' ;
        titleBar.style.margin="0" ;
        titleBar.style.padding="0" ;
        titleBar.style.paddingLeft="10px" ;
        titleBar.style.borderTopLeftRadius = '5px';
        titleBar.style.borderTopRightRadius = '5px';
        modal.appendChild(titleBar);

        const titleMsg = document.createElement('label');
        titleMsg.innerText=alertMessage;
        titleMsg.style.color= "white";
        titleBar.appendChild(titleMsg);

        // Create Modal Body
        const modalBody = document.createElement('div');
        modalBody.style.width="100%" ;
        modalBody.style.height="100%" ;
        modalBody.style.padding = '20px';
        modalBody.style.paddingBottom = '5px';
        modal.appendChild(modalBody);


        // Create message
        const messageParagraph = document.createElement('p');
        messageParagraph.innerHTML = message.replace(/(\r\n|\n|\r)/g, '<br>');    
        messageParagraph.style.paddingBottom = '20px'    
        modalBody.appendChild(messageParagraph);


        // Create buttons
        const btnDiv = document.createElement('div');
        btnDiv.style.display = 'flex'; // Enable flexbox
        btnDiv.style.justifyContent = 'center'; // Center horizontally
        btnDiv.style.alignItems = 'center'; // Center vertically (if needed)
        btnDiv.style.paddingBottom = '0';
        btnDiv.style.marginBottom = '0';
        modalBody.appendChild(btnDiv);

        const buttonArray = buttons.split(',').map(btn => btn.trim());
        buttonArray.forEach((btnText, index) => {
            const button = document.createElement('button'); // Corrected here
            button.textContent = btnText;
            button.style.margin = '5px';
            button.style.width = '80px';
            button.style.height = '30px';
            button.style.display = 'inline-flex';
            button.style.alignItems = 'center'; // align vertically
            button.style.justifyContent= "center";
            button.style.backgroundColor = "var(--main-bg-color)" ;
            button.style.color = "white" ;
            button.style.cursor = "pointer";

            button.onclick = () => {
                resolve(index);  // Resolve with the index of the button clicked
                cleanup();
            };

            btnDiv.appendChild(button); // Append button to btnDiv
        });


        // Append modal to overlay
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        makeDraggable(modal, titleBar)

        // Cleanup function to remove the modal
        function cleanup() {
            document.body.removeChild(overlay);
            // Re-enable scrolling
            document.body.style.overflow = '';            
        }
    });
}

export function makeDraggable(container, handle, storageKey = null) {
    let offsetX = 0, offsetY = 0;
    let isDragging = false;

    handle.style.cursor = 'move';

    handle.addEventListener('mousedown', e => {
        isDragging = true;
        offsetX = e.clientX - container.offsetLeft;
        offsetY = e.clientY - container.offsetTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const newLeft = Math.max(0, e.clientX - offsetX);
        const newTop = Math.max(0, e.clientY - offsetY);
        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
        container.style.position = 'absolute';

        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify({ left: newLeft, top: newTop }));
        }
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // Restore previous position
    if (storageKey) {
        const savedPos = localStorage.getItem(storageKey);
        if (savedPos) {
            const { left, top } = JSON.parse(savedPos);
            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
        }
    }
}
