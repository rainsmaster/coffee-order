import React from 'react';
import { BottomSheet as AstryxBottomSheet } from '@astryxdesign/core/BottomSheet';
import { Heading } from '@astryxdesign/core/Heading';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';

const BottomSheet = ({ isOpen, onClose, title, children }) => {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose();
  };

  return (
    <AstryxBottomSheet
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      label={title || '옵션 선택'}
      purpose="info"
      height="capped"
      padding={0}
    >
      <Layout
        height="fill"
        padding={0}
        header={title ? (
          <LayoutHeader padding={3} hasDivider>
            <Heading level={2}>{title}</Heading>
          </LayoutHeader>
        ) : undefined}
        content={<LayoutContent padding={0}>{children}</LayoutContent>}
      />
    </AstryxBottomSheet>
  );
};

export default BottomSheet;
