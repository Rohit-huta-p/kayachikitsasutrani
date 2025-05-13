interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}



export const Input = ({ className, ...props }: InputProps) => {
    return (
        <input
            {...props}
            className={`ouline-none p-2 bg-white  ${className}`}
        />
    );
}


