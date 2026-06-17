import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, FileText, Mail, Lock, UserCheck } from 'lucide-react'

export default function Policy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 30%, #f0fdf4 60%, #fff7ed 100%)',
      }} />

      <div className="relative max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -3 }}
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 transition-colors font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 8px 25px rgba(139,92,246,0.35)',
              }}
            >
              <Shield className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">
              Privacy Policy & Terms
            </h1>
            <p className="text-ink-400 dark:text-ink-500 mt-2 text-sm">
              Last updated: June 2026
            </p>
          </div>

          {/* Content Card */}
          <div className="rounded-3xl p-[1px] mb-6" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.4) 100%)',
          }}>
            <div className="rounded-3xl p-6 sm:p-8 backdrop-blur-2xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
              <div className="prose pamber-sm max-w-none space-y-8">
                {/* Privacy Policy */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      boxShadow: '0 4px 12px rgba(139,92,246,0.25)',
                    }}>
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-ink-900 dark:text-white">1. Privacy Policy</h2>
                  </div>

                  <div className="space-y-4 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">1.1 Information We Collect</h3>
                      <p>When you create an account on XueTong, we collect:</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Your email address (used for authentication and account recovery)</li>
                        <li>Your chosen username (displayed publicly on leaderboards)</li>
                        <li>Your learning progress, quiz scores, and study statistics</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">1.2 How We Use Your Data</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>To provide and maintain the XueTong learning platform</li>
                        <li>To personalize your learning experience and track progress</li>
                        <li>To display your scores on public leaderboards (username only)</li>
                        <li>To respond to support inquiries sent via the contact form</li>
                        <li>To improve the app based on aggregated, anonymized usage patterns</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">1.3 Data Storage & Security</h3>
                      <p>Your data is stored securely using Supabase infrastructure with industry-standard encryption. We do not sell, trade, or share your personal information with third parties. Your password is hashed and never stored in plain text.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">1.4 Your Rights</h3>
                      <p>You can request deletion of your account and all associated data at any time by contacting us through the support form or email. We will process your request within 30 days.</p>
                    </div>
                  </div>
                </section>

                {/* Terms of Service */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{
                      background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                      boxShadow: '0 4px 12px rgba(236,72,153,0.25)',
                    }}>
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-ink-900 dark:text-white">2. Terms of Service</h2>
                  </div>

                  <div className="space-y-4 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">2.1 Acceptable Use</h3>
                      <p>By using XueTong, you agree to:</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Use the platform for personal HSK vocabulary learning purposes only</li>
                        <li>Not engage in cheating, exploiting bugs, or manipulating quiz scores</li>
                        <li>Not upload or share harmful, illegal, or offensive content</li>
                        <li>Not attempt to access other users' accounts or data</li>
                        <li>Not use automated scripts or bots to interact with the platform</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">2.2 Account Responsibility</h3>
                      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">2.3 Service Availability</h3>
                      <p>XueTong is provided on an "as is" and "as available" basis. We strive for high uptime but do not guarantee uninterrupted service. We reserve the right to modify or discontinue features with reasonable notice.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">2.4 Limitation of Liability</h3>
                      <p>XueTong and its developers shall not be liable for any indirect, incidental, or consequential damages arising from the use or inability to use the platform. Your use of the platform is at your sole risk.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ink-800 dark:text-ink-200 mb-2">2.5 Termination</h3>
                      <p>We reserve the right to suspend or terminate accounts that violate these terms, at our sole discretion and without prior notice.</p>
                    </div>
                  </div>
                </section>

                {/* Contact */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                      boxShadow: '0 4px 12px rgba(6,182,212,0.25)',
                    }}>
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-ink-900 dark:text-white">3. Contact Us</h2>
                  </div>

                  <div className="space-y-3 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                    <p>If you have any questions about this Privacy Policy or Terms of Service, please contact us:</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-red-500" />
                        <span>Via the Contact Support form in the Me tab</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-red-500" />
                        <span>Developer: BABU MD MILTON — <a href="https://miltonbabu.site" target="_blank" rel="noopener noreferrer" className="text-red-600 dark:text-red-400 hover:underline">miltonbabu.site</a></span>
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-ink-400 dark:text-ink-500">
            By using XueTong, you acknowledge that you have read and agree to these policies.
          </p>
        </motion.div>
      </div>
    </div>
  )
}