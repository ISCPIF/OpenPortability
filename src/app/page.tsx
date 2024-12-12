import Image from "next/image";
import { auth } from "./auth";
import ActionProgressBar from "./_components/ActionProgressBar";
import UploadButton from "./_components/UploadButton";
import Header from "./_components/Header";
import ClientPage from "./_components/ClientPage";

export default async function Home() {
  const session = await auth();

  return <ClientPage session={session} />;
}
