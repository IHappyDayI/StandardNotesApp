import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
  $getSelection,
  $createParagraphNode,
  $isRangeSelection,
  $isElementNode,
  $setSelection,
  $getPreviousSelection,
} from 'lexical'
import { $convertFromMarkdownString } from '../../Lexical/Utils/MarkdownImport'
import { MarkdownTransformers } from '../../MarkdownTransformers'
import { $isQuoteNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { $isCollapsibleTitleNode } from '../CollapsiblePlugin/CollapsibleTitleNode'

export default function MarkdownPastePlugin(): JSX.Element | null {
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

          let selection = $getSelection()
          if (!$isRangeSelection(selection)) {
            return false
          }

          const focusedNode = selection.focus.getNode()
          if ($isQuoteNode(focusedNode) || $isCodeNode(focusedNode) || $isCollapsibleTitleNode(focusedNode)) {
            return false
          }

          // Make sure the selection is not backwards, as that causes issues when inserting.
          if (selection.isBackward()) {
            const anchor = selection.anchor
            selection.anchor = selection.focus
            selection.focus = anchor
          }

          // This is an edge case that gets handled later. We need to check the selection at this point though, because it changes in the next step.
          const entireNodeSelected =
            selection.anchor.offset == 0 && focusedNode.getTextContentSize() == selection.focus.offset

          // =======================================
          // TODO: Handle pasting at the beginning of headings / when selecting an entire child node of a heading
          // =======================================

          // Convert the text from the clipboard from markdown to lexical nodes without inserting them into the editor. This updates the selection.
          const tempParagraph = $createParagraphNode()
          $convertFromMarkdownString(text, MarkdownTransformers, tempParagraph, true)
          const children = tempParagraph.getChildren()

          // Restore the initial selection.
          const prevSelection = $getPreviousSelection()
          if (!$isRangeSelection(prevSelection)) {
            return false
          }
          $setSelection(prevSelection.clone())

          // Don't do anything if the text failed to parse as markdown and let the default implementation handle the paste event
          const textWasNotParsedAsMarkdown = children.length == 1 && $isElementNode(children[0])
          if (textWasNotParsedAsMarkdown) {
            return false
          }

          if (entireNodeSelected) {
            selection = $getSelection()
            if (!$isRangeSelection(selection)) {
              return false
            }
          }

          selection.insertNodes(children)

          // TODO: verify test cases
          // * pasting into table
          // * pasting into list
          // * pasting into code block
          // * pasting into a link
          // * pasting into a quote
          // * pasting into a collapsible node
          // * pasting into a heading
          // * pasting complex markdown stuff
          // * pasting a simple string
          // * pasting an image
          // * pasting a link
          // * pasting at the beginning of a word
          // * pasting at the end of a word
          // * pasting in the middle of a word
          // * pasting when having selected a word
          // * pasting when having selected two words
          // * pasting when having selected two words spanning over two lines
          // * pasting when having selected different nodes than textNodes
          // * pasting when having selected an entire paragraph with the focus at the beginning of the paragraph
          // * trying to replace more than one paragraph node

          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    )
  })

  return null
}
