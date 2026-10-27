import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

export function MarkdownView({ body }: { body: string }) {
  return (
    <article className="prose max-w-none [&_:target]:scroll-mt-20 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-neutral-100 [&_pre]:p-3 [&_code]:font-mono">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href, children }) => (
            <a href={href} rel="noopener noreferrer" className="underline">
              {children}
            </a>
          ),
        }}
      >
        {body}
      </Markdown>
    </article>
  );
}
