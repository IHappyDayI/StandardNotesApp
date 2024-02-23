import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { COMMAND_PRIORITY_NORMAL, PASTE_COMMAND, $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createLinkNode, toggleLink } from '@lexical/link'
import { $isQuoteNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { $isCollapsibleTitleNode } from '../CollapsiblePlugin/CollapsibleTitleNode'

export default function LinkPastePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        PASTE_COMMAND,
        (event: ClipboardEvent) => {
          if (!event.clipboardData) {
            return false
          }

          const text = event.clipboardData.getData('text/plain')
          if (!text) {
            return false
          }

          const selection = $getSelection()
          if (!$isRangeSelection(selection)) {
            return false
          }

          const focusedNode = selection.focus.getNode()
          if ($isQuoteNode(focusedNode) || $isCodeNode(focusedNode) || $isCollapsibleTitleNode(focusedNode)) {
            return false
          }

          if (isUrl(text)) {
            // If text from only one node is selected, paste the clipboard content as a link target onto the selected text
            const selectedNodes = selection.extract()
            if (selection.getTextContent() && selectedNodes.length == 1) {
              toggleLink(text)
              return true
            }

            // If no text is selected or multiple nodes are selected, replace the selection with text+link
            const linkNode = $createLinkNode(text).append($createTextNode(text))
            selection.insertNodes([linkNode])
            return true
          }

          return false
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    )
  })

  return null
}

function isUrl(text: string) {
  if (text.match(/\n/)) {
    return false
  }

  try {
    const url = new URL(text)
    return url.hostname !== ''
  } catch (err) {
    return false
  }
}
