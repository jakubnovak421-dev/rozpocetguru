import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stavebný archív | Zakládání staveb',description:'Súkromné úložisko dokumentov, formulárov a stavebného denníka.',icons:{icon:'/logo.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="sk"><body>{children}</body></html>;}
