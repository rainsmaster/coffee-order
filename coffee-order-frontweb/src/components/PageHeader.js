import React from 'react';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

const PageHeader = ({ title, description }) => (
  <VStack gap={2} paddingBlockEnd={4} width="100%">
    <Heading level={1}>{title}</Heading>
    {description && <Text as="p" type="supporting">{description}</Text>}
  </VStack>
);

export default PageHeader;
