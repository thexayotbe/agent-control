import { motion } from 'motion/react'

/** Speech bubble for office chat: white with a hard black border, so it never reads as a task status. */
export function ChatBubble({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { scale: 0.5, opacity: 0, y: 4 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 28 }}
      style={{ transformOrigin: '50% 100%' }}
      className="relative block w-max max-w-[150px] border-2 border-black bg-white px-[5px] py-[3px] text-[10px] leading-[1.25] text-black shadow-[2px_2px_0_#000]"
    >
      <span className="line-clamp-3 break-words">{text}</span>
      <span aria-hidden className="absolute left-1/2 -bottom-[7px] -ml-[3px] block h-[5px] w-[6px] border-x-2 border-b-2 border-black bg-white" />
    </motion.div>
  )
}
