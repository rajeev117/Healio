import Hero from "@/components/home/Hero";
import IntroStatement from "@/components/home/IntroStatement";
import About from "@/components/home/About";
import Services from "@/components/home/Services";
import Projects from "@/components/home/Projects";
import Process from "@/components/home/Process";
import Manifesto from "@/components/home/Manifesto";
import Testimonials from "@/components/home/Testimonials";
import Clients from "@/components/home/Clients";
import ContactCta from "@/components/home/ContactCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <IntroStatement />
      <About />
      <Services />
      <Projects />
      <Process />
      <Manifesto />
      <Testimonials />
      <Clients />
      <ContactCta />
    </>
  );
}
