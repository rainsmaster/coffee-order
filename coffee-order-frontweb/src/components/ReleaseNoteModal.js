import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import Modal from './Modal';

const ReleaseNoteModal = ({ note, onClose, onDismissToday, onDetail }) => (
  <Modal isOpen={Boolean(note)} onClose={onClose} title={note?.title || '업데이트'}>
    {note && (
      <>
        <Text type="supporting">{note.version}</Text>
        <Text as="p" style={{ whiteSpace: 'pre-line' }}>{note.summary}</Text>
        <Button label="자세히 보기" variant="secondary" onClick={onDetail} width="100%" />
        <HStack gap={2} justify="end" wrap="wrap" width="100%">
          <Button label="닫기" variant="ghost" onClick={onClose} />
          <Button label="오늘 하루 보지 않기" variant="primary" onClick={onDismissToday} />
        </HStack>
      </>
    )}
  </Modal>
);

export default ReleaseNoteModal;
