import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-slate max-w-none prose-sm sm:prose-base dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="rounded-md overflow-hidden my-2 shadow-sm border border-slate-200">
                <div className="bg-slate-100 px-3 py-1 text-xs text-slate-500 font-mono border-b border-slate-200">
                  {match[1]}
                </div>
                <SyntaxHighlighter
                  {...props}
                  style={oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: '1rem', background: '#f8fafc' }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code {...props} className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-sm">
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 border rounded-lg border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-50">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{children}</th>;
          },
          td({ children }) {
            return <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 border-t border-slate-100">{children}</td>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
