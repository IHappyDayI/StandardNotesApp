import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
} from 'lexical'

export function InlineCodeShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === 'm'
        ) {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
