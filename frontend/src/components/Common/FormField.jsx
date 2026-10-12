import { cloneElement, useId } from 'react';

export const inputClass = 'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent';

export default function FormField({ label, children }) {
  const generatedId = useId();
  const id = children.props.id || generatedId;
  return <div>
    <label htmlFor={id} className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {cloneElement(children, { id })}
  </div>;
}
