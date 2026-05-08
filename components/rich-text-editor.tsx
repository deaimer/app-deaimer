"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="rounded-[1rem] border border-slate-300 bg-white px-4 py-4 text-sm text-muted">
      Loading editor...
    </div>
  ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: [
        ["bold", "italic"],
        [{ list: "bullet" }, { list: "ordered" }],
        ["clean"],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    [],
  );

  const formats = useMemo(
    () => ["bold", "italic", "list"],
    [],
  );

  return (
    <div className="job-rich-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
