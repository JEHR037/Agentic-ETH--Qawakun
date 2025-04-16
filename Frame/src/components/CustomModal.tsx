import React, { useEffect } from 'react';
import Modal from 'react-modal';

interface CustomModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

const CustomModal: React.FC<CustomModalProps> = ({ isOpen, onRequestClose, children }) => {
  useEffect(() => {
    Modal.setAppElement('body'); // Establece el elemento de la aplicación
  }, []);

  return (
    <Modal 
      isOpen={isOpen} 
      onRequestClose={onRequestClose} 
      style={{
        content: {
          background: 'transparent',
          border: 'none',
          padding: '0',
          width: '60%',
          margin: 'auto',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -20%)',
          zIndex: 1000,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        },
      }}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1001 }}>
        {children}
        <button 
          onClick={onRequestClose} 
          style={{
            backgroundColor: '#f8c20b',
            color: '#171717',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            position: 'absolute',
            top: '10px',
            right: '10px',
          }}
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
};

export default CustomModal; 