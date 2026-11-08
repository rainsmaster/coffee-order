import React from 'react';
import Modal from './Modal';
import './ReleaseNoteModal.css';

const ReleaseNoteModal = ({ note, onClose, onDismissToday, onDetail }) => {
  if (!note) return null;
  return (
    <Modal isOpen={Boolean(note)} onClose={onClose} title={note.title}>
      <div className="release-note-version">{note.version}</div>
      <p className="release-note-summary">{note.summary}</p>
      <button type="button" className="btn-link release-note-detail" onClick={onDetail}>
        자세히 보기
      </button>
      <div className="release-note-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>닫기</button>
        <button type="button" className="btn-primary" onClick={onDismissToday}>오늘 하루 보지 않기</button>
      </div>
    </Modal>
  );
};

export default ReleaseNoteModal;
