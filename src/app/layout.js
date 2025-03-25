import RootLayout from './layout.client';
import { metadata, viewport } from './metadata';

export { metadata, viewport };

export default function ServerLayout(props) {
  return <RootLayout {...props} />;
} 