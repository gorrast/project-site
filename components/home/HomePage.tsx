import Link from 'next/link'
import Image from 'next/image'

interface Project {
  title: string
  description: string
  href: string
  tags: string[]
  image?: React.ReactNode
}

const projects: Project[] = [
  {
    title: 'Blue Bay Cup',
    description:
      'Fantasy Draft Premier League tracker for the Blue Bay Cup league. Tracks season development, overall performance, and more. Fetches data from FPL api, and stores in a Supabase DB',
    href: '/bluebaycup',
    tags: ['Fantasy Football', 'Statistics'],
    image: (
      <Image
        src="/bluebaycup_project.png"
        alt="Blue Bay Cup"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
      />
    ),
  },
  {
    title: 'Playpilot Compare',
    description:
      'Evaluate and compare data for Playpilot profiles',
    href: '/playpilot',
    tags: ['Selenium', 'Statistics', 'Movies & TV'],
    /* image: (
      <Image
        src="/bluebaycup_project.png"
        alt="Blue Bay Cup"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
      />
    ), */
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20">

        {/* Header */}
        <div className="mb-16">
          <div className="bg-linear-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-4">Projects</h1>
          </div>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl">
            A collection of things I&apos;ve been building.
          </p>
          <div className="mt-5 h-1 w-16 bg-linear-to-r from-blue-600 to-purple-600 rounded-full" />
        </div>

        {/* Project grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map(project => (
            <Link
              key={project.href}
              href={project.href}
              className="group flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-700 hover:-translate-y-1 transition-all duration-200"
            >
              {/* Image slot — replace the inner div with <Image src="..." fill className="object-cover" alt="..." /> */}
              <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
                {project.image ?? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-gray-300 dark:text-gray-600 text-sm select-none">Image coming soon</span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="flex flex-col flex-1 p-6">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-150">
                  {project.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
                  {project.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all duration-150">
                  View project
                  <span className="transition-transform duration-150 group-hover:translate-x-1">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Hugo Wigh</span>
          <a
            href="mailto:hugo@wigh.nu"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150"
          >
            hugo@wigh.nu
          </a>
        </div>
      </footer>
    </div>
  )
}
